"""把 I2V 生成的原始视频压成首页可用的 hero 视频。

用法（在 frontend 目录下）：
    python scripts/encode_hero_video.py ../raw/dragon.mp4
    python scripts/encode_hero_video.py ../raw/dragon.mp4 --max-kb 400

策略：按「清晰度优先」的阶梯逐档降，第一档达标就停。
输出固定为 src/assets/dragon-hero.mp4 —— Vite 会把它打进 /assets/ 带 hash 文件名，
命中 nginx 的 immutable 长缓存（放 public/ 反而没有缓存头）。

依赖：pip install imageio-ffmpeg（自带 ffmpeg 二进制，不碰 github）
"""
import argparse
import os
import re
import subprocess
import sys

import imageio_ffmpeg

# (宽度, crf)：从「画质优先」往下走，第一档体积达标就停。
# crf 越小越清晰。深色渐变的封面容易出色带，所以起点定在 crf24（而不是一味压小）。
LADDER = [(960, 24), (960, 26), (960, 28), (896, 30), (832, 32), (720, 34)]
BANDWIDTH_MBPS = 3.0
TCP_EFFICIENCY = 0.85


def probe(ffmpeg, path):
    """解析 ffmpeg -i 的 stderr，拿时长和分辨率（不依赖 ffprobe）。"""
    err = subprocess.run([ffmpeg, "-hide_banner", "-i", path],
                         capture_output=True, text=True, errors="ignore").stderr
    dur = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", err)
    seconds = 0.0
    if dur:
        h, m, s = dur.groups()
        seconds = int(h) * 3600 + int(m) * 60 + float(s)
    res = re.search(r"Video:.*?,\s*(\d{2,5})x(\d{2,5})", err)
    size = (int(res.group(1)), int(res.group(2))) if res else (0, 0)
    return seconds, size


def preprocess(ffmpeg, src, dst, start=0.0, length=None, pingpong=False, loopfade=None):
    """截取窗口 + 循环处理。

    loopfade=F：单向循环，只在接缝处做 F 秒叠化。
        把窗口末尾 F 秒叠到开头 F 秒上，接缝处的错位就从「整个窗口的运动量」
        降成「F 秒的运动量」，视觉上是一层柔和过渡而不是硬跳。
    pingpong：正放+倒放，接缝数学上为 0，但时长翻倍。
    """
    cmd = [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", src]

    if loopfade:
        if not length:
            raise SystemExit("--loopfade 需要同时给 --length")
        s, e, f = start, start + length, loopfade
        fc = (
            f"[0:v]trim=start={s}:end={s + f:.3f},setpts=PTS-STARTPTS[h];"
            f"[0:v]trim=start={e - f:.3f}:end={e:.3f},setpts=PTS-STARTPTS[t];"
            f"[0:v]trim=start={s + f:.3f}:end={e:.3f},setpts=PTS-STARTPTS[m];"
            f"[t][h]xfade=transition=fade:duration={f}:offset=0[b];"
            f"[b][m]concat=n=2:v=1[v]"
        )
        cmd += ["-filter_complex", fc, "-map", "[v]"]
    else:
        if pingpong:
            # 截取也放进滤镜链：-t 放输出端会把回文后的结果又截短
            pre = ""
            if start or length:
                end = f"end={start + length}" if length else ""
                pre = f"trim=start={start}:{end},setpts=PTS-STARTPTS,"
            cmd += ["-filter_complex",
                    f"[0:v]{pre}split=2[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]",
                    "-map", "[v]"]
        else:
            if start:
                cmd += ["-ss", str(start)]
            if length:
                cmd += ["-t", str(length)]

    cmd += ["-an", "-c:v", "libx264", "-crf", "16", "-preset", "fast",
            "-pix_fmt", "yuv420p", dst]
    subprocess.run(cmd, check=True)


def seam_diff(ffmpeg, path, tmpdir):
    """量化首尾帧差异：越小越接近无缝。返回 0~255 的平均灰度差。"""
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return None
    first = os.path.join(tmpdir, "_seam_first.png")
    last = os.path.join(tmpdir, "_seam_last.png")
    for outp, extra in ((first, []), (last, ["-sseof", "-0.08"])):
        subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                        *extra, "-i", path, "-frames:v", "1",
                        "-vf", "scale=240:-2", outp], check=True)
    a = np.asarray(Image.open(first).convert("L"), dtype=float)
    b = np.asarray(Image.open(last).convert("L"), dtype=float)
    os.remove(first)
    os.remove(last)
    return float(np.abs(a - b).mean())


def crop_filter(sw, sh, aspect, valign="center"):
    """按目标宽高比裁切。valign 决定纵向取哪一段：top / center / bottom。"""
    if sw <= 0 or sh <= 0 or aspect <= 0:
        return None
    current = sw / sh
    if abs(current - aspect) < 0.01:
        return None

    if current > aspect:
        # 比目标更宽 → 裁左右，纵向不动
        cw, ch = int(round(sh * aspect)), sh
        x, y = (sw - cw) // 2, 0
    else:
        # 比目标更高 → 裁上下，横向不动
        cw, ch = sw, int(round(sw / aspect))
        x = 0
        y = {"top": 0, "bottom": sh - ch}.get(valign, (sh - ch) // 2)

    cw -= cw % 2      # H.264 要求偶数边长
    ch -= ch % 2
    return f"crop={cw}:{ch}:{x}:{y}"


def crush_filter(black_point):
    """把暗部压到纯黑。

    为什么需要：素材（I2V 生成的图/视频）背景不是纯黑而是 11~20 的雾状灰，
    screen 混合只能让「纯黑」消失，灰背景会变成一层罩在页面上的灰雾（看起来像阴影）。
    压黑点把这层雾打成 0，混合后背景就等于页面底色。
    """
    if not black_point or black_point <= 0:
        return None
    bp = black_point
    return f"curves=all='0/0 {bp}/0 0.5/0.55 1/1'"


def encode(ffmpeg, src, dst, width, crf, fps, crop=None, crush=None):
    # -2 让高度按比例取偶数（H.264 yuv420p 要求偶数）
    chain = [crop, crush, f"scale={width}:-2:flags=lanczos", f"fps={fps}"]
    vf = ",".join(part for part in chain if part)
    cmd = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", src,
        "-an",                                  # 无音轨：首屏背景不需要声音
        "-vf", vf,
        "-c:v", "libx264",
        "-profile:v", "high", "-level", "4.0",
        "-crf", str(crf),
        "-preset", "veryslow",                  # 一次性离线编码，慢一点换体积
        "-pix_fmt", "yuv420p",                  # Safari/移动端兼容
        "-g", str(int(fps) * 2),                # 关键帧间隔短一点，循环更顺
        "-movflags", "+faststart",              # moov 前置，边下边播
        dst,
    ]
    subprocess.run(cmd, check=True)


def load_time(kb):
    """3Mbps 固定带宽下的理论下载耗时（含 TCP 开销折算）。"""
    bits = kb * 1024 * 8
    return bits / (BANDWIDTH_MBPS * 1_000_000) / TCP_EFFICIENCY


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="I2V 导出的原始视频")
    ap.add_argument("--out", default=os.path.join("src", "assets", "dragon-hero.mp4"))
    ap.add_argument("--max-kb", type=int, default=400)
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--aspect", type=float, default=2.28,
                    help="目标宽高比，按首页 hero 的 1760:772≈2.28 裁切；传 0 关闭裁切")
    ap.add_argument("--valign", choices=["top", "center", "bottom"], default="center",
                    help="裁上下时取哪一段；龙角被切就试 top")
    ap.add_argument("--start", type=float, default=0.0, help="从第几秒开始截取")
    ap.add_argument("--length", type=float, default=None, help="截取多长（秒）")
    ap.add_argument("--loopfade", type=float, default=None, metavar="F",
                    help="单向循环 + 接缝叠化 F 秒（推荐 0.3）；需要配合 --length")
    ap.add_argument("--pingpong", action="store_true",
                    help="正放+倒放，接缝严格为 0 但时长翻倍（会看到倒放）")
    ap.add_argument("--crush", type=float, default=0.09, metavar="BP",
                    help="压黑点 0~1：素材背景的雾状灰压成纯黑，screen 混合后才干净。"
                         "量大就调大（0.12~0.15），传 0 关闭")
    args = ap.parse_args()

    if not os.path.exists(args.input):
        sys.exit(f"找不到输入文件：{args.input}")

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()

    work = args.input
    if args.start or args.length or args.pingpong or args.loopfade:
        work = args.out + ".src.mp4"
        os.makedirs(os.path.dirname(work) or ".", exist_ok=True)
        mode = ("单向 + 接缝叠化 %.2fs" % args.loopfade if args.loopfade
                else "正放+倒放" if args.pingpong else "仅截取")
        print(f"预处理：{args.start:.2f}s 起取 {args.length or '全部'}s，{mode} ...", flush=True)
        preprocess(ffmpeg, args.input, work, args.start, args.length,
                   args.pingpong, args.loopfade)

    src_sec, src_res = probe(ffmpeg, work)
    src_kb = os.path.getsize(work) / 1024
    print(f"源文件: {args.input}")
    print(f"        处理后 {src_res[0]}x{src_res[1]}  {src_sec:.2f}s  {src_kb:.0f} KB")

    seam = seam_diff(ffmpeg, work, os.path.dirname(work) or ".")
    if seam is not None:
        verdict = "无缝" if seam < 3 else ("轻微" if seam < 8 else "会跳")
        print(f"        循环接缝：{seam:.2f} / 255（{verdict}；相邻帧抖动约 1.2，整段硬切约 17）")

    crop = crop_filter(src_res[0], src_res[1], args.aspect, args.valign) if args.aspect else None
    if crop:
        print(f"        裁切 → {crop.replace('crop=', '').replace(':', ' x ', 1)}"
              f"（目标 {args.aspect:.2f}:1）")
    else:
        print("        无需裁切" if args.aspect else "        已关闭裁切")

    crush = crush_filter(args.crush)
    print(f"        压黑点 {args.crush:.2f}" if crush else "        未压黑点")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    tmp = args.out + ".tmp.mp4"

    for width, crf in LADDER:
        print(f"\n→ 尝试 宽{width} crf{crf} ...", flush=True)
        encode(ffmpeg, work, tmp, width, crf, args.fps, crop, crush)
        kb = os.path.getsize(tmp) / 1024
        sec, res = probe(ffmpeg, tmp)
        print(f"  结果 {res[0]}x{res[1]} {sec:.2f}s  {kb:.0f} KB  "
              f"（3Mbps 下载 ≈ {load_time(kb):.1f}s）")
        if kb <= args.max_kb:
            os.replace(tmp, args.out)
            if work != args.input and os.path.exists(work):
                os.remove(work)          # 清掉预处理中间文件
            print(f"\n✅ 达标，已写入 {args.out}")
            print(f"   最终 {kb:.0f} KB / {res[0]}x{res[1]} / {sec:.2f}s / {args.fps}fps")
            print(f"   3Mbps 首屏加载 ≈ {load_time(kb):.1f}s")
            return

    # 全部档位都不达标：交出最小的一版，让调用方决定
    os.replace(tmp, args.out)
    kb = os.path.getsize(args.out) / 1024
    print(f"\n⚠️ 压到最后一档仍有 {kb:.0f} KB（目标 {args.max_kb} KB）")
    print("   建议：缩短时长到 3 秒，或换一段动态更小的素材，或把 --max-kb 放宽")
    sys.exit(1)


if __name__ == "__main__":
    main()
