import os
from functools import wraps

from flask import redirect, session, url_for
from werkzeug.security import check_password_hash

from db import db

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "")
ADMIN_PASSWORD_HASH = os.environ.get("ADMIN_PASSWORD_HASH", "")


def verificar_login(login, senha):
    """Retorna ('admin', None), ('cliente', cliente_dict) ou (None, None)."""
    if login and ADMIN_USERNAME and login == ADMIN_USERNAME and ADMIN_PASSWORD_HASH:
        if check_password_hash(ADMIN_PASSWORD_HASH, senha):
            return "admin", None

    conn = db()
    try:
        row = conn.execute(
            "SELECT * FROM clientes WHERE login = %s AND ativo = TRUE", (login,)
        ).fetchone()
    finally:
        conn.close()

    if row and check_password_hash(row["senha_hash"], senha):
        return "cliente", dict(row)

    return None, None


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("is_admin"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("cliente_id"):
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped


def current_cliente_id():
    return session.get("cliente_id")
