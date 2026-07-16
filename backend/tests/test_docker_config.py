"""
Static verification tests for SIGMA Docker configuration files.

These tests are STATIC file-based checks (no Docker engine required):
- Presence of env.example (dotless copy, primary bugfix subject) and .env.example
- Content equality of both env templates
- Presence of all required env variables
- docker-compose.yaml validity + services (mongo, backend, frontend) + volume + network
- Dockerfiles (backend python:3.11-slim + expose 8001; frontend multi-stage + ARG)
- nginx.conf reverse-proxy configuration
- .dockerignore files presence
"""

import os
import re
import yaml
import pytest

REPO_ROOT = "/app"

ENV_EXAMPLE_DOTLESS = os.path.join(REPO_ROOT, "env.example")
ENV_EXAMPLE_DOT = os.path.join(REPO_ROOT, ".env.example")
COMPOSE_FILE = os.path.join(REPO_ROOT, "docker-compose.yaml")
BACKEND_DOCKERFILE = os.path.join(REPO_ROOT, "backend", "Dockerfile")
FRONTEND_DOCKERFILE = os.path.join(REPO_ROOT, "frontend", "Dockerfile")
NGINX_CONF = os.path.join(REPO_ROOT, "frontend", "nginx.conf")
BACKEND_DOCKERIGNORE = os.path.join(REPO_ROOT, "backend", ".dockerignore")
FRONTEND_DOCKERIGNORE = os.path.join(REPO_ROOT, "frontend", ".dockerignore")

REQUIRED_ENV_VARS = [
    "MONGO_URL",
    "DB_NAME",
    "JWT_SECRET",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD",
    "FRONTEND_URL",
    "CORS_ORIGINS",
    "REACT_APP_BACKEND_URL",
    "FRONTEND_PORT",
    "BACKEND_PORT",
]


# ---------- env.example (bugfix) ----------
class TestEnvExampleDotless:
    """Primary bug: user reported '.env.example tidak ada'. Fix = /app/env.example."""

    def test_env_example_dotless_exists(self):
        assert os.path.isfile(ENV_EXAMPLE_DOTLESS), (
            "/app/env.example MUST exist (visibility fix for user's bug)"
        )

    def test_env_example_dotless_not_empty(self):
        assert os.path.getsize(ENV_EXAMPLE_DOTLESS) > 0

    def test_env_example_dotfile_exists(self):
        assert os.path.isfile(ENV_EXAMPLE_DOT), "/app/.env.example must also exist"

    def test_both_files_identical(self):
        with open(ENV_EXAMPLE_DOTLESS, "rb") as f1, open(ENV_EXAMPLE_DOT, "rb") as f2:
            assert f1.read() == f2.read(), "env.example and .env.example must be identical"

    @pytest.mark.parametrize("var", REQUIRED_ENV_VARS)
    def test_required_var_in_dotless(self, var):
        content = open(ENV_EXAMPLE_DOTLESS).read()
        assert re.search(rf"^{var}=", content, re.MULTILINE), f"{var} missing from env.example"

    @pytest.mark.parametrize("var", REQUIRED_ENV_VARS)
    def test_required_var_in_dotfile(self, var):
        content = open(ENV_EXAMPLE_DOT).read()
        assert re.search(rf"^{var}=", content, re.MULTILINE), f"{var} missing from .env.example"


# ---------- docker-compose.yaml ----------
class TestDockerCompose:
    def test_file_exists(self):
        assert os.path.isfile(COMPOSE_FILE)

    def test_valid_yaml(self):
        with open(COMPOSE_FILE) as f:
            data = yaml.safe_load(f)
        assert isinstance(data, dict)

    def test_has_three_services(self):
        data = yaml.safe_load(open(COMPOSE_FILE))
        services = data.get("services", {})
        for svc in ("mongo", "backend", "frontend"):
            assert svc in services, f"service '{svc}' missing"

    def test_mongo_data_volume(self):
        data = yaml.safe_load(open(COMPOSE_FILE))
        assert "mongo_data" in data.get("volumes", {}), "mongo_data volume missing"

    def test_sigma_net_network(self):
        data = yaml.safe_load(open(COMPOSE_FILE))
        assert "sigma-net" in data.get("networks", {}), "sigma-net network missing"

    def test_usage_comment_uses_dotless(self):
        """Usage comment should point to `cp env.example .env` (no dot prefix)."""
        content = open(COMPOSE_FILE).read()
        assert "cp env.example .env" in content, (
            "docker-compose.yaml Usage comment must reference `cp env.example .env`"
        )

    @pytest.mark.parametrize("var", ["JWT_SECRET", "MONGO_URL", "DB_NAME", "CORS_ORIGINS",
                                     "ADMIN_EMAIL", "ADMIN_PASSWORD", "FRONTEND_URL",
                                     "BACKEND_PORT", "FRONTEND_PORT", "REACT_APP_BACKEND_URL"])
    def test_compose_var_defined_in_env_example(self, var):
        """Every var referenced by compose must be present in env.example."""
        compose_content = open(COMPOSE_FILE).read()
        env_content = open(ENV_EXAMPLE_DOTLESS).read()
        if f"${{{var}" in compose_content:
            assert re.search(rf"^{var}=", env_content, re.MULTILINE), (
                f"{var} used in compose but missing from env.example"
            )

    def test_services_attached_to_network(self):
        data = yaml.safe_load(open(COMPOSE_FILE))
        for svc_name in ("mongo", "backend", "frontend"):
            svc = data["services"][svc_name]
            # frontend/backend/mongo should either have networks list or default
            nets = svc.get("networks")
            # mongo & backend explicitly declared; frontend expected too
            if svc_name in ("mongo", "backend"):
                assert nets and "sigma-net" in nets, f"{svc_name} missing sigma-net"


# ---------- Backend Dockerfile ----------
class TestBackendDockerfile:
    def test_exists(self):
        assert os.path.isfile(BACKEND_DOCKERFILE)

    def test_uses_python_311_slim(self):
        content = open(BACKEND_DOCKERFILE).read()
        assert re.search(r"^FROM\s+python:3\.11-slim", content, re.MULTILINE)

    def test_exposes_8001(self):
        content = open(BACKEND_DOCKERFILE).read()
        assert re.search(r"^EXPOSE\s+8001", content, re.MULTILINE)


# ---------- Frontend Dockerfile ----------
class TestFrontendDockerfile:
    def test_exists(self):
        assert os.path.isfile(FRONTEND_DOCKERFILE)

    def test_multi_stage_node_and_nginx(self):
        content = open(FRONTEND_DOCKERFILE).read()
        assert re.search(r"FROM\s+node:20-alpine", content), "node:20-alpine builder missing"
        assert re.search(r"FROM\s+nginx:", content), "nginx runtime stage missing"

    def test_accepts_react_app_backend_url_arg(self):
        content = open(FRONTEND_DOCKERFILE).read()
        assert re.search(r"^ARG\s+REACT_APP_BACKEND_URL", content, re.MULTILINE)


# ---------- nginx.conf ----------
class TestNginxConf:
    def test_exists(self):
        assert os.path.isfile(NGINX_CONF)

    def test_reverse_proxy_api_to_backend_8001(self):
        content = open(NGINX_CONF).read()
        assert "location /api/" in content, "no /api/ location block"
        # upstream references backend:8001 either via upstream or direct proxy_pass
        assert re.search(r"backend:8001", content), "backend:8001 upstream target missing"


# ---------- .dockerignore ----------
class TestDockerignore:
    def test_backend_dockerignore_exists(self):
        assert os.path.isfile(BACKEND_DOCKERIGNORE)

    def test_frontend_dockerignore_exists(self):
        assert os.path.isfile(FRONTEND_DOCKERIGNORE)
