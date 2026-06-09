"""
Rate limiting service for SaaS usage protection.
Tracks daily limits for uploads, questions, and enforces throttling.
"""

import threading
from datetime import datetime, timedelta
from typing import Dict, Tuple
from collections import defaultdict


class RateLimiter:
    """Thread-safe rate limiter with daily quota tracking."""
    
    # Default limits (can be overridden per user/tier)
    DEFAULT_UPLOADS_PER_DAY = 50
    DEFAULT_QUESTIONS_PER_DAY = 100
    DEFAULT_UPLOAD_SIZE_MB = 50
    
    def __init__(self):
        self.uploads_today: Dict[str, int] = defaultdict(int)  # user_id -> count
        self.questions_today: Dict[str, int] = defaultdict(int)  # user_id -> count
        self.last_upload_time: Dict[str, datetime] = {}  # user_id -> datetime
        self.last_question_time: Dict[str, datetime] = {}  # user_id -> datetime
        self.user_limits: Dict[str, Dict] = {}  # user_id -> {uploads, questions, upload_size_mb}
        self.lock = threading.Lock()
        self.day_reset_hour = 0  # UTC hour to reset daily counters
        self.logger_prefix = "[RateLimiter]"
    
    def _get_date_key(self, dt: datetime = None) -> str:
        """Get date key for quota tracking (YYYY-MM-DD)."""
        if dt is None:
            dt = datetime.utcnow()
        return dt.strftime("%Y-%m-%d")
    
    def set_user_limits(self, user_id: str, uploads_per_day: int = None, 
                        questions_per_day: int = None, upload_size_mb: int = None):
        """Set custom limits for a specific user."""
        with self.lock:
            self.user_limits[user_id] = {
                "uploads_per_day": uploads_per_day or self.DEFAULT_UPLOADS_PER_DAY,
                "questions_per_day": questions_per_day or self.DEFAULT_QUESTIONS_PER_DAY,
                "upload_size_mb": upload_size_mb or self.DEFAULT_UPLOAD_SIZE_MB,
            }
    
    def _get_user_limits(self, user_id: str) -> Dict:
        """Get limits for a user (custom or default)."""
        return self.user_limits.get(user_id, {
            "uploads_per_day": self.DEFAULT_UPLOADS_PER_DAY,
            "questions_per_day": self.DEFAULT_QUESTIONS_PER_DAY,
            "upload_size_mb": self.DEFAULT_UPLOAD_SIZE_MB,
        })
    
    def check_upload_quota(self, user_id: str, file_size_mb: float = 0) -> Tuple[bool, str]:
        """
        Check if user can upload a file.
        Returns (allowed: bool, message: str)
        """
        with self.lock:
            limits = self._get_user_limits(user_id)
            today = self._get_date_key()
            
            # Check file size
            if file_size_mb > limits["upload_size_mb"]:
                return False, f"File exceeds {limits['upload_size_mb']}MB limit"
            
            # Check daily quota
            uploads_today = self.uploads_today.get(f"{user_id}:{today}", 0)
            if uploads_today >= limits["uploads_per_day"]:
                return False, f"Daily upload limit ({limits['uploads_per_day']}) reached. Resets at midnight UTC."
            
            return True, "OK"
    
    def record_upload(self, user_id: str):
        """Record an upload for quota tracking."""
        with self.lock:
            today = self._get_date_key()
            key = f"{user_id}:{today}"
            self.uploads_today[key] += 1
            self.last_upload_time[user_id] = datetime.utcnow()
    
    def check_question_quota(self, user_id: str) -> Tuple[bool, str]:
        """
        Check if user can ask a question.
        Returns (allowed: bool, message: str)
        """
        with self.lock:
            limits = self._get_user_limits(user_id)
            today = self._get_date_key()
            
            # Check daily quota
            questions_today = self.questions_today.get(f"{user_id}:{today}", 0)
            if questions_today >= limits["questions_per_day"]:
                return False, f"Daily question limit ({limits['questions_per_day']}) reached. Resets at midnight UTC."
            
            return True, "OK"
    
    def record_question(self, user_id: str):
        """Record a question for quota tracking."""
        with self.lock:
            today = self._get_date_key()
            key = f"{user_id}:{today}"
            self.questions_today[key] += 1
            self.last_question_time[user_id] = datetime.utcnow()
    
    def get_user_usage_today(self, user_id: str) -> Dict:
        """Get current usage stats for user today."""
        with self.lock:
            today = self._get_date_key()
            limits = self._get_user_limits(user_id)
            uploads_key = f"{user_id}:{today}"
            questions_key = f"{user_id}:{today}"
            
            uploads_used = self.uploads_today.get(uploads_key, 0)
            questions_used = self.questions_today.get(questions_key, 0)
            
            return {
                "uploads_used": uploads_used,
                "uploads_limit": limits["uploads_per_day"],
                "uploads_remaining": max(0, limits["uploads_per_day"] - uploads_used),
                "questions_used": questions_used,
                "questions_limit": limits["questions_per_day"],
                "questions_remaining": max(0, limits["questions_per_day"] - questions_used),
                "upload_size_limit_mb": limits["upload_size_mb"],
            }


# Global rate limiter instance
rate_limiter = RateLimiter()
