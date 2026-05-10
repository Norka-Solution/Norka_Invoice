from django.contrib import admin
from .models import Company, BankDetails, Client, Invoice, InvoiceItem, Payment


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1
    fields = ['description_en', 'quantity', 'unit_price', 'currency', 'exchange_rate', 'category']


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    fields = ['payment_date', 'amount', 'method', 'reference']


class BankDetailsInline(admin.TabularInline):
    model = BankDetails
    extra = 0


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ['name_en', 'name_ar', 'email', 'phone', 'trn']
    inlines = [BankDetailsInline]


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display  = ['name_en', 'company', 'contact_person', 'email', 'phone']
    list_filter   = ['company']
    search_fields = ['name_en', 'email', 'contact_person']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display    = ['invoice_number', 'client', 'status', 'issue_date', 'due_date', 'total_aed', 'balance_due']
    list_filter     = ['status', 'company', 'issue_date', 'vat_enabled']
    search_fields   = ['invoice_number', 'client__name_en']
    readonly_fields = ['invoice_number', 'created_at', 'updated_at', 'created_by']
    inlines         = [InvoiceItemInline, PaymentInline]
    ordering        = ['-created_at']


admin.site.register(BankDetails)

admin.site.site_header  = 'NORKA Solution — Invoice Admin'
admin.site.site_title   = 'NORKA Invoice'
admin.site.index_title  = 'Invoice Management'
