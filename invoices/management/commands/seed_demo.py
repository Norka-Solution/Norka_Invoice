import datetime
import decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from invoices.models import Company, BankDetails, Client, Invoice, InvoiceItem, Payment

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed demo data: company, clients, invoices, payments'

    def handle(self, *args, **options):
        self.stdout.write('Seeding demo data...')

        user, _ = User.objects.get_or_create(
            username='norka',
            defaults={'is_staff': True, 'is_superuser': True, 'email': 'norka@norka.ae'},
        )
        if not user.has_usable_password():
            user.set_password('norka2026')
            user.save()

        company, _ = Company.objects.get_or_create(
            name_en='NORKA Solution',
            defaults={
                'name_ar': 'نوركا سوليوشن',
                'address_en': 'Office 402, Al Nahyan Tower, Abu Dhabi, UAE',
                'address_ar': 'مكتب 402، برج النهيان، أبوظبي، الإمارات',
                'phone': '+971 2 555 0100',
                'email': 'info@norka.ae',
                'trn': '100123456700003',
                'website': 'https://norka.ae',
            },
        )

        bank, _ = BankDetails.objects.get_or_create(
            company=company,
            bank_name='First Abu Dhabi Bank',
            defaults={
                'account_name': 'NORKA Solution LLC',
                'account_number': '0123456789',
                'iban': 'AE070331234567890123456',
                'swift_code': 'NBADAEAAXXX',
                'branch': 'Abu Dhabi Main Branch',
                'currency': 'AED',
                'is_default': True,
            },
        )

        clients_data = [
            {
                'name_en': 'Emirates NBD',
                'name_ar': 'بنك الإمارات دبي الوطني',
                'contact_person': 'Ahmed Al Mansoori',
                'email': 'procurement@emiratesnbd.ae',
                'phone': '+971 4 600 5000',
                'address_en': 'Baniyas Road, Deira, Dubai, UAE',
                'address_ar': 'شارع بني ياس، ديرة، دبي',
                'trn': '100234567800003',
            },
            {
                'name_en': 'ADNOC Distribution',
                'name_ar': 'توزيع أدنوك',
                'contact_person': 'Sara Al Rashidi',
                'email': 'it@adnocdist.ae',
                'phone': '+971 2 602 0000',
                'address_en': 'ADNOC HQ, Corniche Road, Abu Dhabi, UAE',
                'address_ar': 'المقر الرئيسي لأدنوك، طريق الكورنيش، أبوظبي',
                'trn': '100345678900003',
            },
            {
                'name_en': 'Mubadala Investment',
                'name_ar': 'مبادلة للاستثمار',
                'contact_person': 'Khalid Al Mazrouei',
                'email': 'vendor@mubadala.ae',
                'phone': '+971 2 413 0000',
                'address_en': 'Sowwah Square, Al Maryah Island, Abu Dhabi',
                'address_ar': 'ساحة الصوى، جزيرة المارية، أبوظبي',
                'trn': '100456789000003',
            },
            {
                'name_en': 'Abu Dhabi Digital Authority',
                'name_ar': 'سلطة أبوظبي الرقمية',
                'contact_person': 'Noura Al Hammadi',
                'email': 'procurement@adda.gov.ae',
                'phone': '+971 2 200 5000',
                'address_en': 'Rabdan Building, Abu Dhabi Government District',
                'address_ar': 'مبنى ربدان، المنطقة الحكومية بأبوظبي',
                'trn': '100567890100003',
            },
        ]

        clients = []
        for cd in clients_data:
            c, _ = Client.objects.get_or_create(company=company, name_en=cd['name_en'], defaults=cd)
            clients.append(c)

        today = datetime.date.today()

        invoices_data = [
            # Paid invoices (past months)
            {
                'client': clients[0], 'status': 'paid',
                'issue_date': today - datetime.timedelta(days=150),
                'due_date':   today - datetime.timedelta(days=120),
                'items': [
                    {'desc_en': 'Enterprise Software License – Q1 2025', 'desc_ar': 'ترخيص برمجيات مؤسسية', 'qty': 1, 'price': 18500, 'cat': 'subscription'},
                    {'desc_en': 'Implementation & Setup Services',       'desc_ar': 'خدمات التنفيذ والإعداد', 'qty': 5, 'price': 1200,  'cat': 'service'},
                ],
                'payment_date': today - datetime.timedelta(days=115),
            },
            {
                'client': clients[1], 'status': 'paid',
                'issue_date': today - datetime.timedelta(days=120),
                'due_date':   today - datetime.timedelta(days=90),
                'items': [
                    {'desc_en': 'Mobile App Development – Phase 1', 'desc_ar': 'تطوير تطبيق الجوال – المرحلة الأولى', 'qty': 1, 'price': 32000, 'cat': 'development'},
                ],
                'payment_date': today - datetime.timedelta(days=85),
            },
            {
                'client': clients[2], 'status': 'paid',
                'issue_date': today - datetime.timedelta(days=90),
                'due_date':   today - datetime.timedelta(days=60),
                'items': [
                    {'desc_en': 'IT Infrastructure Consulting', 'desc_ar': 'استشارات البنية التحتية لتقنية المعلومات', 'qty': 10, 'price': 2800, 'cat': 'service'},
                    {'desc_en': 'Network Security Audit',       'desc_ar': 'تدقيق أمن الشبكات',                         'qty': 1,  'price': 8500, 'cat': 'service'},
                ],
                'payment_date': today - datetime.timedelta(days=55),
            },
            {
                'client': clients[3], 'status': 'paid',
                'issue_date': today - datetime.timedelta(days=60),
                'due_date':   today - datetime.timedelta(days=30),
                'items': [
                    {'desc_en': 'Cloud Migration Services – Batch A', 'desc_ar': 'خدمات الترحيل السحابي – الدفعة أ', 'qty': 1, 'price': 45000, 'cat': 'service'},
                ],
                'payment_date': today - datetime.timedelta(days=25),
            },
            # Sent / awaiting payment
            {
                'client': clients[0], 'status': 'sent',
                'issue_date': today - datetime.timedelta(days=20),
                'due_date':   today + datetime.timedelta(days=10),
                'items': [
                    {'desc_en': 'Enterprise Software License – Q2 2025', 'desc_ar': 'ترخيص برمجيات مؤسسية – الربع الثاني', 'qty': 1, 'price': 18500, 'cat': 'subscription'},
                    {'desc_en': 'Monthly Support & Maintenance',          'desc_ar': 'دعم وصيانة شهرية',                    'qty': 3, 'price': 1500,  'cat': 'maintenance'},
                ],
            },
            {
                'client': clients[2], 'status': 'sent',
                'issue_date': today - datetime.timedelta(days=15),
                'due_date':   today + datetime.timedelta(days=15),
                'items': [
                    {'desc_en': 'ERP System Customization', 'desc_ar': 'تخصيص نظام إدارة الموارد', 'qty': 1, 'price': 28000, 'cat': 'development'},
                ],
            },
            # Partially paid
            {
                'client': clients[1], 'status': 'partially_paid',
                'issue_date': today - datetime.timedelta(days=45),
                'due_date':   today - datetime.timedelta(days=15),
                'items': [
                    {'desc_en': 'Mobile App Development – Phase 2', 'desc_ar': 'تطوير تطبيق الجوال – المرحلة الثانية', 'qty': 1, 'price': 40000, 'cat': 'development'},
                ],
                'partial_payment': 20000,
                'payment_date': today - datetime.timedelta(days=10),
            },
            # Overdue
            {
                'client': clients[3], 'status': 'overdue',
                'issue_date': today - datetime.timedelta(days=50),
                'due_date':   today - datetime.timedelta(days=20),
                'items': [
                    {'desc_en': 'Data Analytics Platform Setup', 'desc_ar': 'إعداد منصة تحليل البيانات', 'qty': 1, 'price': 22000, 'cat': 'development'},
                    {'desc_en': 'Training Sessions – 3 days',    'desc_ar': 'جلسات تدريبية – 3 أيام',     'qty': 3, 'price': 2000,  'cat': 'service'},
                ],
            },
            # Draft
            {
                'client': clients[0], 'status': 'draft',
                'issue_date': today,
                'due_date':   today + datetime.timedelta(days=30),
                'items': [
                    {'desc_en': 'Cybersecurity Assessment – FY2025', 'desc_ar': 'تقييم الأمن السيبراني', 'qty': 1, 'price': 15000, 'cat': 'service'},
                ],
            },
            {
                'client': clients[2], 'status': 'draft',
                'issue_date': today,
                'due_date':   today + datetime.timedelta(days=30),
                'items': [
                    {'desc_en': 'Annual Software Maintenance Contract', 'desc_ar': 'عقد صيانة برمجيات سنوي', 'qty': 1, 'price': 9600, 'cat': 'maintenance'},
                ],
            },
        ]

        created = 0
        for idx, inv_data in enumerate(invoices_data, start=1):
            inv_num = f'INV-2025-{idx:03d}'
            if Invoice.objects.filter(invoice_number=inv_num).exists():
                continue

            invoice = Invoice.objects.create(
                company=company,
                client=inv_data['client'],
                invoice_number=inv_num,
                status=inv_data['status'],
                issue_date=inv_data['issue_date'],
                due_date=inv_data['due_date'],
                vat_enabled=True,
                vat_rate=decimal.Decimal('5.00'),
                bank_details=bank,
                created_by=user,
            )

            for i, it in enumerate(inv_data['items']):
                InvoiceItem.objects.create(
                    invoice=invoice,
                    description_en=it['desc_en'],
                    description_ar=it['desc_ar'],
                    quantity=decimal.Decimal(str(it['qty'])),
                    unit_price=decimal.Decimal(str(it['price'])),
                    currency='AED',
                    exchange_rate=decimal.Decimal('1.00'),
                    category=it['cat'],
                    sort_order=i,
                )

            if inv_data['status'] == 'paid' and 'payment_date' in inv_data:
                subtotal = sum(
                    decimal.Decimal(str(it['qty'])) * decimal.Decimal(str(it['price']))
                    for it in inv_data['items']
                )
                total_with_vat = subtotal * decimal.Decimal('1.05')
                Payment.objects.create(
                    invoice=invoice,
                    amount=total_with_vat,
                    payment_date=inv_data['payment_date'],
                    method='bank_transfer',
                    reference=f'PAY-{inv_num}',
                )

            if inv_data['status'] == 'partially_paid' and 'partial_payment' in inv_data:
                Payment.objects.create(
                    invoice=invoice,
                    amount=decimal.Decimal(str(inv_data['partial_payment'])),
                    payment_date=inv_data['payment_date'],
                    method='bank_transfer',
                    reference=f'PAY-{inv_num}-PARTIAL',
                )

            created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done. Created {created} invoices, {len(clients_data)} clients, 1 company.'
        ))
