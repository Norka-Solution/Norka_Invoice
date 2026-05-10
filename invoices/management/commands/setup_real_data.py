"""
Management command: clean fake seed data and enter the real INV-2026-003 invoice.
"""
import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from invoices.models import Company, Client, Invoice, InvoiceItem


class Command(BaseCommand):
    help = 'Remove fake seed data and enter real invoice INV-2026-003'

    def handle(self, *args, **options):
        # 1. Delete fake seed company (email = info@norka.ae)
        fake = Company.objects.filter(email='info@norka.ae').first()
        if fake:
            inv_count = fake.invoices.count()
            cli_count = fake.clients.count()
            # Must delete invoices first (PROTECT on client FK), then clients, then company
            fake.invoices.all().delete()
            fake.clients.all().delete()
            fake.delete()
            self.stdout.write(self.style.SUCCESS(
                f'Deleted fake company "{fake.name_en}" with {cli_count} clients and {inv_count} invoices.'
            ))
        else:
            self.stdout.write('No fake company found (already cleaned or different email).')

        # 2. Find the real company, or recreate it if accidentally deleted
        company = Company.objects.first()
        if not company:
            from invoices.models import BankDetails
            company = Company.objects.create(
                name_en='NORKA Solution',
                name_ar='نوركا سوليشن',
                phone='+971 50 725 7157',
                email='info@norka.solution.com',
                address_en='Abu Dhabi, UAE',
            )
            self.stdout.write(self.style.WARNING(
                'Company was missing — recreated "NORKA Solution". '
                'Please go to Settings and re-enter your bank account details.'
            ))
        self.stdout.write(f'Using company: {company.name_en}')

        # 3. Create Stride Construction if it doesn't exist
        client, created = Client.objects.get_or_create(
            company=company,
            name_en='Stride Construction',
            defaults={
                'name_ar': 'Stride Construction',
                'contact_person': '',
                'email': '',
                'phone': '',
                'address_en': '',
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Created client: Stride Construction'))
        else:
            self.stdout.write(f'Client already exists: {client.name_en}')

        # 4. Get default bank account
        bank = company.bank_accounts.filter(is_default=True).first() or company.bank_accounts.first()

        # 5. Create INV-2026-003 (skip if already exists)
        inv_number = 'INV-2026-003'
        if Invoice.objects.filter(invoice_number=inv_number).exists():
            self.stdout.write(f'Invoice {inv_number} already exists — skipping.')
            return

        inv = Invoice(
            company=company,
            client=client,
            invoice_number=inv_number,
            status='sent',
            issue_date=datetime.date(2026, 4, 1),
            due_date=datetime.date(2026, 4, 7),
            vat_enabled=False,
            vat_rate=Decimal('5.00'),
            notes_en='',
            bank_details=bank,
        )
        inv.save()

        items = [
            {
                'description_en': 'Render Cloud Hosting',
                'description_ar': 'Render Cloud Hosting',
                'quantity': 1,
                'unit_price': Decimal('20.00'),
                'currency': 'USD',
                'exchange_rate': Decimal('3.670000'),
                'category': 'subscription',
                'sort_order': 1,
            },
            {
                'description_en': 'Monthly Dev & Maintenance',
                'description_ar': 'Monthly Dev & Maintenance',
                'quantity': 1,
                'unit_price': Decimal('2000.00'),
                'currency': 'AED',
                'exchange_rate': Decimal('1.000000'),
                'category': 'maintenance',
                'sort_order': 2,
            },
            {
                'description_en': 'Mobile Line 0566526225',
                'description_ar': 'Mobile Line 0566526225',
                'quantity': 1,
                'unit_price': Decimal('288.75'),
                'currency': 'AED',
                'exchange_rate': Decimal('1.000000'),
                'category': 'service',
                'sort_order': 3,
            },
            {
                'description_en': 'Mobile Line 0566599497',
                'description_ar': 'Mobile Line 0566599497',
                'quantity': 1,
                'unit_price': Decimal('236.25'),
                'currency': 'AED',
                'exchange_rate': Decimal('1.000000'),
                'category': 'service',
                'sort_order': 4,
            },
        ]

        for item_data in items:
            InvoiceItem.objects.create(invoice=inv, **item_data)

        total = inv.total_aed
        self.stdout.write(self.style.SUCCESS(
            f'Created invoice {inv_number} — Client: Stride Construction — Total: AED {total}'
        ))
        self.stdout.write(self.style.SUCCESS('Done!'))
