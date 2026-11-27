from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AnalyzeView,
    ExportView,
    HealthView,
    LoginView,
    MeView,
    PolygonAnalyzeView,
    RegisterView,
    SiteDetailView,
    SiteListView,
    SiteUploadView,
    StatisticsView,
    WeightsView,
)

urlpatterns = [
    path('health/', HealthView.as_view(), name='api-health'),
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('sites/', SiteListView.as_view(), name='site-list'),
    path('sites/upload/', SiteUploadView.as_view(), name='site-upload'),
    path('sites/<int:site_id>/', SiteDetailView.as_view(), name='site-detail'),
    path('analyze/', AnalyzeView.as_view(), name='analyze'),
    path('analyze/polygon/', PolygonAnalyzeView.as_view(), name='analyze-polygon'),
    path('weights/', WeightsView.as_view(), name='weights'),
    path('statistics/', StatisticsView.as_view(), name='statistics'),
    path('export/', ExportView.as_view(), name='export'),
]
