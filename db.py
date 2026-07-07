import os

import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)


class _DB:
    def __init__(self):
        self._conn = psycopg2.connect(DATABASE_URL)

    def execute(self, sql, params=None):
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute(sql, params or [])
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.commit()
        else:
            self.rollback()
        self.close()


def db():
    return _DB()
