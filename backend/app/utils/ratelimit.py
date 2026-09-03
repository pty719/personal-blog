from collections import defaultdict
from datetime import datetime, timedelta

_calls = defaultdict(list)
def check_rate_limit(ip: str, limit: int = 10, windows_seconds : int = 60) -> bool:
    now = datetime.now()
    _calls[ip] = [t for t in _calls[ip] if now - t < timedelta(seconds=windows_seconds )]
    if len(_calls[ip]) >= limit:
        return False
    _calls[ip].append(now)
    return True