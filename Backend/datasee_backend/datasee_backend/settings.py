"""
Django settings for datasee_backend project.
"""

from datetime import timedelta
import importlib.util
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env if present
load_dotenv(BASE_DIR / '.env', override=True)

# Detect test execution so managed/unmanaged schema and isolated test DB work seamlessly
TESTING = len(sys.argv) > 1 and sys.argv[1] == 'test'
if TESTING:
    MIGRATION_MODULES = {'sites_api': None}

SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-79=4%&=p800&^)4gy(ip0&bd2n-!^*d&z@h%ax&ylhnizonijg',
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('1', 'true', 'yes')

ALLOWED_HOSTS = [
    h.strip()
    for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if h.strip()
]
railway_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '').strip()
if railway_domain and railway_domain not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(railway_domain)
if os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('PORT'):
    if '*' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append('*')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party apps
    'corsheaders',
    'rest_framework',
    'drf_spectacular',
    # Local apps
    'sites_api',
]

HAS_WHITENOISE = importlib.util.find_spec('whitenoise') is not None

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    *(
        ['whitenoise.middleware.WhiteNoiseMiddleware']
        if HAS_WHITENOISE
        else []
    ),
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'datasee_backend.urls'

# Optional built Angular SPA directory (used in Docker / Railway single-service deploy)
_frontend_env = os.environ.get('FRONTEND_DIST_DIR', '').strip()
_default_frontend_dir = BASE_DIR.parent.parent / 'frontend_dist'
if _frontend_env and Path(_frontend_env).is_dir():
    FRONTEND_DIST_DIR: Path | None = Path(_frontend_env)
elif _default_frontend_dir.is_dir():
    FRONTEND_DIST_DIR = _default_frontend_dir
else:
    FRONTEND_DIST_DIR = None

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [FRONTEND_DIST_DIR] if FRONTEND_DIST_DIR else [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'datasee_backend.wsgi.application'

# Database configuration (supports local .env and Railway MySQL MYSQL* env variables)
DB_NAME = os.environ.get('DB_NAME') or os.environ.get('MYSQLDATABASE', 'solar_site_analyzer')
DB_USER = os.environ.get('DB_USER') or os.environ.get('MYSQLUSER', 'root')
DB_PASSWORD = (
    os.environ.get('DB_PASSWORD')
    if os.environ.get('DB_PASSWORD') is not None
    else os.environ.get('MYSQLPASSWORD', '')
)
DB_HOST = os.environ.get('DB_HOST') or os.environ.get('MYSQLHOST', '127.0.0.1')
DB_PORT = os.environ.get('DB_PORT') or os.environ.get('MYSQLPORT', '3306')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': DB_NAME,
        'HOST': DB_HOST,
        'PORT': DB_PORT,
        'USER': DB_USER,
        'PASSWORD': DB_PASSWORD,
        'OPTIONS': {
            'charset': 'utf8mb4',
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
if FRONTEND_DIST_DIR:
    WHITENOISE_ROOT = FRONTEND_DIST_DIR

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS, CSRF & Proxy HTTPS configuration
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        'CORS_ALLOWED_ORIGINS', 'http://localhost:4200,http://127.0.0.1:4200'
    ).split(',')
    if origin.strip()
]
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'https://*.up.railway.app',
]
if railway_domain:
    railway_origin = f'https://{railway_domain}'
    if railway_origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(railway_origin)
    if railway_origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(railway_origin)

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

# In-memory cache for statistics & heavy aggregations (invalidated on analyze/upload)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'solar-site-analyzer-cache',
        'TIMEOUT': 300,
    }
}

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'URL_FORMAT_OVERRIDE': None,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# OpenAPI / Swagger UI metadata
SPECTACULAR_SETTINGS = {
    'TITLE': 'Solar Panel Site Analyzer API',
    'DESCRIPTION': 'Spatial suitability analysis, scoring, statistics, and export API for solar installation sites.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
