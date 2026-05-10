from rest_framework import serializers
from .models import Company, BankDetails, Client, Invoice, InvoiceItem, Payment


class BankDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankDetails
        fields = '__all__'
        read_only_fields = ['id']


class CompanySerializer(serializers.ModelSerializer):
    bank_accounts = BankDetailsSerializer(many=True, required=False)

    class Meta:
        model = Company
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def _save_banks(self, company, banks_data):
        company.bank_accounts.all().delete()
        for bd in banks_data:
            bd.pop('id', None)
            bd.pop('company', None)
            BankDetails.objects.create(company=company, **bd)

    def create(self, validated_data):
        banks_data = validated_data.pop('bank_accounts', [])
        company = super().create(validated_data)
        self._save_banks(company, banks_data)
        return company

    def update(self, instance, validated_data):
        banks_data = validated_data.pop('bank_accounts', None)
        instance = super().update(instance, validated_data)
        if banks_data is not None:
            self._save_banks(instance, banks_data)
        return instance


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class InvoiceItemSerializer(serializers.ModelSerializer):
    total_aed  = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceItem
        fields = '__all__'
        read_only_fields = ['id', 'invoice']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class InvoiceListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name_en', read_only=True)
    total_aed   = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_paid  = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'client', 'client_name', 'status',
            'issue_date', 'due_date', 'total_aed', 'total_paid', 'balance_due', 'created_at',
        ]


class InvoiceDetailSerializer(serializers.ModelSerializer):
    items        = InvoiceItemSerializer(many=True, read_only=True)
    payments     = PaymentSerializer(many=True, read_only=True)
    client_data  = ClientSerializer(source='client', read_only=True)
    bank_data    = BankDetailsSerializer(source='bank_details', read_only=True)
    subtotal_aed = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    vat_amount   = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_aed    = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_paid   = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    balance_due  = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['id', 'invoice_number', 'created_at', 'updated_at', 'created_by']


class InvoiceCreateSerializer(serializers.ModelSerializer):
    items        = InvoiceItemSerializer(many=True)
    bank_details = serializers.PrimaryKeyRelatedField(
        queryset=BankDetails.objects.all(), allow_null=True, required=False
    )

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number',
            'company', 'client', 'issue_date', 'due_date', 'period_start', 'period_end',
            'vat_enabled', 'vat_rate', 'notes_en', 'notes_ar', 'bank_details', 'items',
        ]
        read_only_fields = ['id', 'invoice_number']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        invoice = Invoice.objects.create(**validated_data)
        for i, item_data in enumerate(items_data):
            item_data['sort_order'] = i
            InvoiceItem.objects.create(invoice=invoice, **item_data)
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for i, item_data in enumerate(items_data):
                item_data['sort_order'] = i
                InvoiceItem.objects.create(invoice=instance, **item_data)
        return instance
