# -*- coding: utf-8 -*-
"""建表 + 初始化管理员账号。第一次跑项目先执行这个。
【运行方式】在 backend 目录下：python init_db.py
（重复执行安全：表已存在会跳过，管理员已存在会跳过）
"""
from app.auth import hash_password
from app.db import Base, SessionLocal, engine
from app.models import User  # noqa: F401  确保模型被导入、注册进 Base.metadata

# 1. 建表：按 models.py 里所有 __tablename__ 创建（已存在的不动）
Base.metadata.create_all(engine)
print("[OK] 数据表创建完成")

# 2. 初始化管理员账号（只在第一次跑时插入）
db = SessionLocal()
try:
    admin = db.query(User).filter(User.username == "admin").first()
    if admin is None:
        db.add(User(
            username="admin",
            password_hash=hash_password("admin123"),   # 初始密码，上线前记得改
            nickname="站长",
            is_admin=True,
        ))
        db.commit()
        print("[OK] 管理员已创建：admin / admin123")
    else:
        print("[SKIP] 管理员已存在")
finally:
    db.close()
