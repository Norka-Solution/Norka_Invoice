from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet, BankDetailsViewSet, ClientViewSet,
    InvoiceViewSet, PaymentViewSet, DashboardView, ExchangeRateView, AllPaymentsView,
)
from .ai_views import AIChatView

router = DefaultRouter()
router.register('companies',    CompanyViewSet, basename='company')
router.register('bank-details', BankDetailsViewSet)
router.register('clients',      ClientViewSet)
router.register('invoices',     InvoiceViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path(
        'invoices/<uuid:invoice_pk>/payments/',
        PaymentViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='invoice-payments-list',
    ),
    path(
        'invoices/<uuid:invoice_pk>/payments/<uuid:pk>/',
        PaymentViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}),
        name='invoice-payments-detail',
    ),
    path('dashboard/',      DashboardView.as_view(),    name='dashboard'),
    path('exchange-rates/', ExchangeRateView.as_view(), name='exchange-rates'),
    path('payments/',       AllPaymentsView.as_view(),  name='all-payments'),
    path('ai/chat/',        AIChatView.as_view(),       name='ai-chat'),
]
