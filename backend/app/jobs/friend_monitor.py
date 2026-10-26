from datetime import datetime

import httpx
from apscheduler.schedulers.background import BackgroundScheduler


from ..db import SessionLocal
from ..models import Friend


def check_all_friends():
    db = SessionLocal()
    try:
        friends = db.query(Friend).all()
        active = inactive = 0
        for friend in friends:
            try:
                # 先 HEAD（轻量，不下载正文）；但有些服务器/框架不支持 HEAD（返回 405/501），
                # 这时用 GET 复核一次，避免把好站误判成"可能失效"
                r = httpx.head(friend.url, timeout=5, follow_redirects=True)
                if r.status_code >= 400:
                    r = httpx.get(friend.url, timeout=8, follow_redirects=True)
                friend.is_active = r.status_code < 400
            except Exception:
                friend.is_active = False
            friend.last_check = datetime.now()
            active += friend.is_active
            inactive += not friend.is_active
        db.commit()
        return {"total": len(friends), "active": active, "inactive": inactive}
    finally:
        db.close()

