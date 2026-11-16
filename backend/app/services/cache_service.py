import json
import logging
import redis
from flask import current_app

logger = logging.getLogger(__name__)


class CacheService:
    """Redis-based caching service with in-memory / graceful fallback."""

    def __init__(self, app=None):
        self.redis_client = None
        self._in_memory_cache = {}
        if app:
            self.init_app(app)

    def init_app(self, app):
        if app.config.get('TESTING', False):
            # In testing mode, directly use in-memory cache
            self.redis_client = None
            return

        redis_url = app.config.get('REDIS_URL', 'redis://localhost:6379/0')
        try:
            self.redis_client = redis.from_url(
                redis_url,
                socket_connect_timeout=0.8,
                socket_timeout=0.8,
                decode_responses=True
            )
            self.redis_client.ping()
            logger.info("Connected to Redis successfully.")
        except Exception as e:
            logger.warning(f"Redis is unavailable at {redis_url}: {e}. Fallback to in-memory/direct DB querying.")
            self.redis_client = None

    def _is_redis_available(self):
        if not self.redis_client:
            return False
        try:
            self.redis_client.ping()
            return True
        except Exception:
            return False

    def get(self, key):
        """Retrieve key from Redis, fallback to memory."""
        try:
            if self._is_redis_available():
                val = self.redis_client.get(key)
                return json.loads(val) if val else None
        except Exception as e:
            logger.debug(f"Redis GET failed for {key}: {e}")
        return self._in_memory_cache.get(key)

    def set(self, key, value, timeout=None):
        """Set key in Redis with TTL, fallback to memory."""
        if timeout is None:
            timeout = current_app.config.get('CACHE_DEFAULT_TIMEOUT', 300) if current_app else 300

        try:
            if self._is_redis_available():
                serialized = json.dumps(value)
                self.redis_client.setex(key, timeout, serialized)
                return True
        except Exception as e:
            logger.debug(f"Redis SET failed for {key}: {e}")

        self._in_memory_cache[key] = value
        return True

    def delete(self, key):
        """Delete specific key."""
        try:
            if self._is_redis_available():
                self.redis_client.delete(key)
        except Exception as e:
            logger.debug(f"Redis DELETE failed for {key}: {e}")
        self._in_memory_cache.pop(key, None)

    def delete_pattern(self, pattern):
        """Delete all keys matching pattern (e.g., 'treks:*')."""
        try:
            if self._is_redis_available():
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
        except Exception as e:
            logger.debug(f"Redis DELETE_PATTERN failed for {pattern}: {e}")

        # In-memory pattern clear
        prefix = pattern.replace('*', '')
        keys_to_del = [k for k in self._in_memory_cache if k.startswith(prefix)]
        for k in keys_to_del:
            self._in_memory_cache.pop(k, None)

    # High-level Trek cache methods
    def get_cached_treks(self, filter_key=None):
        cache_key = f"treks:filter:{filter_key}" if filter_key else "treks:open"
        return self.get(cache_key)

    def set_cached_treks(self, treks_data, filter_key=None):
        cache_key = f"treks:filter:{filter_key}" if filter_key else "treks:open"
        timeout = current_app.config.get('CACHE_DEFAULT_TIMEOUT', 300) if current_app else 300
        return self.set(cache_key, treks_data, timeout=timeout)

    def get_cached_trek_detail(self, trek_id):
        return self.get(f"trek:detail:{trek_id}")

    def set_cached_trek_detail(self, trek_id, trek_data):
        timeout = current_app.config.get('CACHE_DEFAULT_TIMEOUT', 300) if current_app else 300
        return self.set(f"trek:detail:{trek_id}", trek_data, timeout=timeout)

    def invalidate_trek_cache(self, trek_id=None):
        """Invalidate all trek listings and specific trek detail cache."""
        self.delete_pattern("treks:*")
        if trek_id:
            self.delete(f"trek:detail:{trek_id}")


cache = CacheService()
