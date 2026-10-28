import os, tempfile
from pathlib import Path
import pytest
@pytest.fixture(autouse=True)
def isolated_db(monkeypatch, tmp_path):
    monkeypatch.setenv('DATABASE_PATH',str(tmp_path/'test.sqlite3'))
    # Reload settings/storage so each test gets an isolated file.
    from app.core import config, storage
    config.settings.database_path=str(tmp_path/'test.sqlite3')
    monkeypatch.setattr(config.settings,'gemini_api_key','')
    storage.init_db()
    from app.core.seed import seed_workflows
    seed_workflows()
