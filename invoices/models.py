import uuid
import datetime
from django.db import models, transaction
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from decimal import Decimal


class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name_en = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True)
    address_en = models.TextField(blank=True)
    address_ar = models.TextField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    trn = models.CharField(max_length=50, blank=True, verbose_name='Tax Registration Number')
    website = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Companies'

    def __str__(self):
        return self.name_en


class BankDetails(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='bank_accounts')
    bank_name = models.CharField(max_length=200)
    account_name = models.CharField(max_length=200)
    account_number = models.CharField(max_length=50)
    iban = models.CharField(max_length=34)
    swift_code = models.CharField(max_length=11)
    branch = models.CharField(max_length=200, blank=True)
    currency = models.CharField(max_length=3, default='AED')
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name_plural = 'Bank Details'

    def save(self, *args, **kwargs):
        if self.is_default:
            BankDetails.objects.filter(
                company=self.company, is_default=True
            ).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.bank_name} — {self.account_name}"


class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='clients')
    name_en = models.CharField(max_length=200)
    name_ar = models.CharField(max_length=200, blank=True)
    contact_person = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address_en = models.TextField(blank=True)
    address_ar = models.TextField(blank=True)
    trn = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name_en


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='invoices')
    invoice_number = models.CharField(max_length=50, unique=True, editable=False)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='invoices')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    issue_date = models.DateField()
    due_date = models.DateField()
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    vat_enabled = models.BooleanField(default=False)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('5.00'))
    notes_en = models.TextField(blank=True)
    notes_ar = models.TextField(blank=True)
    bank_details = models.ForeignKey(
        BankDetails, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            year = self.issue_date.year if self.issue_date else datetime.date.today().year
            prefix = f'INV-{year}-'
            with transaction.atomic():
                nums = list(
                    Invoice.objects
                    .filter(invoice_number__startswith=prefix)
                    .select_for_update()
                    .values_list('invoice_number', flat=True)
                )
                existing = []
                for n in nums:
                    try:
                        existing.append(int(n[len(prefix):]))
                    except (ValueError, IndexError):
                        pass
                next_num = (max(existing) + 1) if existing else 1
                self.invoice_number = f'{prefix}{str(next_num).zfill(3)}'
        super().save(*args, **kwargs)

    @property
    def subtotal_aed(self):
        return sum(item.total_aed for item in self.items.all())

    @property
    def vat_amount(self):
        if self.vat_enabled:
            return self.subtotal_aed * (self.vat_rate / 100)
        return Decimal('0')

    @property
    def total_aed(self):
        return self.subtotal_aed + self.vat_amount

    @property
    def total_paid(self):
        return sum(p.amount for p in self.payments.all())

    @property
    def balance_due(self):
        return self.total_aed - self.total_paid

    def update_status(self):
        if self.status in ('draft', 'cancelled'):
            return
        paid = self.total_paid
        total = self.total_aed
        if paid >= total:
            self.status = 'paid'
        elif paid > 0:
            self.status = 'partially_paid'
        elif self.due_date < datetime.date.today():
            self.status = 'overdue'
        self.save(update_fields=['status'])

    def __str__(self):
        return f"{self.invoice_number} — {self.client.name_en}"


class InvoiceItem(models.Model):
    CURRENCY_CHOICES = [('AED', 'AED'), ('USD', 'USD'), ('EUR', 'EUR')]
    CATEGORY_CHOICES = [
        ('subscription', 'Subscription'),
        ('service', 'Service'),
        ('product', 'Product'),
        ('development', 'Development'),
        ('maintenance', 'Maintenance'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    description_en = models.CharField(max_length=500)
    description_ar = models.CharField(max_length=500, blank=True)
    quantity = models.IntegerField(default=1, validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='AED')
    exchange_rate = models.DecimalField(
        max_digits=10, decimal_places=6, default=Decimal('1.000000')
    )
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='service')
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'id']

    @property
    def line_total(self):
        return self.unit_price * self.quantity

    @property
    def total_aed(self):
        return self.line_total * self.exchange_rate

    def __str__(self):
        return f"{self.description_en} ({self.invoice.invoice_number})"


class Payment(models.Model):
    METHOD_CHOICES = [
        ('bank_transfer', 'Bank Transfer'),
        ('cash', 'Cash'),
        ('cheque', 'Cheque'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    payment_date = models.DateField()
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='bank_transfer')
    reference = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.invoice.update_status()

    def __str__(self):
        return f"Payment {self.amount} AED — {self.invoice.invoice_number}"
