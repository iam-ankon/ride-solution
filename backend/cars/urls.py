# backend/cars/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'cars', views.CarViewSet)
router.register(r'contact', views.ContactViewSet)
router.register(r'rentals', views.RentalViewSet)
router.register(r'auth', views.AuthViewSet, basename='auth')
router.register(r'admin-dashboard', views.AdminDashboardViewSet, basename='admin-dashboard')

urlpatterns = [
    path('', include(router.urls)),
    path('stripe-webhook/', views.stripe_webhook, name='stripe-webhook'),
]