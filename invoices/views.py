import datetime
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.db.models import Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from .models import Company, BankDetails, Client, Invoice, InvoiceItem, Payment
from .serializers import (
    CompanySerializer, BankDetailsSerializer, ClientSerializer,
    InvoiceListSerializer, InvoiceDetailSerializer, InvoiceCreateSerializer,
    PaymentSerializer,
)


class CompanyViewSet(viewsets.ModelViewSet):
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]
    queryset = Company.objects.none()

    def get_queryset(self):
        return Company.objects.prefetch_related('bank_accounts').all()


class BankDetailsViewSet(viewsets.ModelViewSet):
    serializer_class = BankDetailsSerializer
    filterset_fields = ['company', 'is_default']
    permission_classes = [IsAuthenticated]
    queryset = BankDetails.objects.none()

    def get_queryset(self):
        return BankDetails.objects.all()


class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    filterset_fields = ['company']
    search_fields = ['name_en', 'name_ar', 'email', 'contact_person']
    ordering_fields = ['name_en', 'created_at']
    permission_classes = [IsAuthenticated]
    queryset = Client.objects.none()

    def get_queryset(self):
        return Client.objects.all()


class InvoiceViewSet(viewsets.ModelViewSet):
    filterset_fields = ['company', 'client', 'status']
    search_fields = ['invoice_number', 'client__name_en']
    ordering_fields = ['created_at', 'issue_date', 'due_date', 'status']
    permission_classes = [IsAuthenticated]
    queryset = Invoice.objects.none()

    def get_queryset(self):
        return Invoice.objects.select_related(
            'client', 'bank_details', 'company', 'created_by'
        ).prefetch_related('items', 'payments')

    def get_serializer_class(self):
        if self.action == 'list':
            return InvoiceListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return InvoiceCreateSerializer
        return InvoiceDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status == 'draft':
            invoice.status = 'sent'
            invoice.save(update_fields=['status'])
        return Response({'status': invoice.status})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = 'cancelled'
        invoice.save(update_fields=['status'])
        return Response({'status': invoice.status})

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        invoice = self.get_object()
        today = datetime.date.today()
        new_invoice = Invoice.objects.create(
            company=invoice.company,
            client=invoice.client,
            issue_date=today,
            due_date=today + datetime.timedelta(days=30),
            vat_enabled=invoice.vat_enabled,
            vat_rate=invoice.vat_rate,
            notes_en=invoice.notes_en,
            notes_ar=invoice.notes_ar,
            bank_details=invoice.bank_details,
            created_by=request.user,
        )
        for item in invoice.items.all():
            InvoiceItem.objects.create(
                invoice=new_invoice,
                description_en=item.description_en,
                description_ar=item.description_ar,
                quantity=item.quantity,
                unit_price=item.unit_price,
                currency=item.currency,
                exchange_rate=item.exchange_rate,
                category=item.category,
                sort_order=item.sort_order,
            )
        return Response(
            InvoiceDetailSerializer(new_invoice, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'])
    def recent_items(self, request):
        from django.db.models import Max
        items = (
            InvoiceItem.objects
            .values('description_en', 'description_ar', 'category', 'unit_price', 'currency', 'exchange_rate')
            .annotate(last_used=Max('invoice__issue_date'))
            .order_by('-last_used')[:60]
        )
        return Response(list(items))

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        invoice = self.get_object()

        CAT_LABELS = {
            'subscription': ('Subscription', 'اشتراك'),
            'service':      ('Service',      'خدمة'),
            'product':      ('Product',      'منتج'),
            'development':  ('Development',  'تطوير'),
            'maintenance':  ('Maintenance',  'صيانة'),
            'other':        ('Other',        'أخرى'),
        }
        LETTERS = 'ABCDEFGHIJKLMNOP'
        seen, groups, row_num = {}, [], 0
        for item in invoice.items.all():
            cat = item.category
            if cat not in seen:
                seen[cat] = len(groups)
                en, ar = CAT_LABELS.get(cat, (cat.title(), cat))
                groups.append({
                    'letter':         LETTERS[len(groups)],
                    'category':       cat,
                    'label_en':       en,
                    'label_ar':       ar,
                    'numbered_items': [],
                })
            row_num += 1
            groups[seen[cat]]['numbered_items'].append({'num': row_num, 'item': item})

        html = render_to_string('invoices/invoice_pdf.html', {
            'invoice':     invoice,
            'item_groups': groups,
            'request':     request,
        })
        try:
            import weasyprint
            pdf = weasyprint.HTML(
                string=html,
                base_url=request.build_absolute_uri('/')
            ).write_pdf()
            response = HttpResponse(pdf, content_type='application/pdf')
            response['Content-Disposition'] = (
                f'attachment; filename="{invoice.invoice_number}.pdf"'
            )
            return response
        except ImportError:
            return HttpResponse(html, content_type='text/html')


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    filterset_fields = ['method']
    permission_classes = [IsAuthenticated]
    queryset = Payment.objects.none()

    def get_queryset(self):
        return Payment.objects.filter(invoice_id=self.kwargs['invoice_pk'])

    def perform_create(self, serializer):
        invoice = Invoice.objects.get(pk=self.kwargs['invoice_pk'])
        serializer.save(invoice=invoice)


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = datetime.date.today()
        first_day = today.replace(day=1)
        invoices = Invoice.objects.all()

        paid_this_month = float(
            Payment.objects.filter(payment_date__gte=first_day)
            .aggregate(s=Sum('amount'))['s'] or 0
        )

        total_outstanding = float(
            sum(inv.balance_due for inv in
                Invoice.objects.filter(status__in=['sent', 'partially_paid', 'overdue'])
                .prefetch_related('items', 'payments'))
        )

        # Last 6 months revenue
        monthly = []
        for i in range(5, -1, -1):
            d = today.replace(day=1) - datetime.timedelta(days=i * 28)
            d = d.replace(day=1)
            if d.month == 12:
                next_m = d.replace(year=d.year + 1, month=1, day=1)
            else:
                next_m = d.replace(month=d.month + 1, day=1)
            amt = float(
                Payment.objects.filter(payment_date__gte=d, payment_date__lt=next_m)
                .aggregate(s=Sum('amount'))['s'] or 0
            )
            monthly.append({'month': d.strftime('%b'), 'amount': amt})

        return Response({
            'total_invoices':    invoices.count(),
            'draft_count':       invoices.filter(status='draft').count(),
            'sent_count':        invoices.filter(status='sent').count(),
            'paid_count':        invoices.filter(status='paid').count(),
            'overdue_count':     invoices.filter(status='overdue').count(),
            'partially_paid_count': invoices.filter(status='partially_paid').count(),
            'paid_this_month':   paid_this_month,
            'total_outstanding': total_outstanding,
            'monthly_revenue':   monthly,
        })


class ExchangeRateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'USD': 3.67, 'EUR': 4.01, 'AED': 1.0})
