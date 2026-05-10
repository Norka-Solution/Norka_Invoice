"""
Set real company bank account and logo.
"""
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.files import File
from invoices.models import Company, BankDetails

LOGO_PATH = Path(__file__).resolve().parents[3] / 'frontend' / 'public' / 'android-chrome-512x512.png'


class Command(BaseCommand):
    help = 'Set ADCB bank account and NORKA logo on the company'

    def handle(self, *args, **options):
        company = Company.objects.first()
        if not company:
            self.stdout.write(self.style.ERROR('No company found.'))
            return

        # Bank account
        company.bank_accounts.all().delete()
        BankDetails.objects.create(
            company=company,
            bank_name='Abu Dhabi Commercial Bank (ADCB)',
            account_name='AHMED KAMEL SAAD AMIN',
            account_number='13345861820001',
            iban='AE370030013345861820001',
            swift_code='ADCBAEAA',
            branch='IBD - Khaldiya Tower Branch',
            currency='AED',
            is_default=True,
        )
        self.stdout.write(self.style.SUCCESS('Bank account saved: ADCB'))

        # Logo
        if LOGO_PATH.exists():
            with open(LOGO_PATH, 'rb') as f:
                company.logo.save('norka-logo.png', File(f), save=True)
            self.stdout.write(self.style.SUCCESS(f'Logo uploaded from {LOGO_PATH.name}'))
        else:
            self.stdout.write(self.style.WARNING(f'Logo file not found at {LOGO_PATH}'))

        self.stdout.write(self.style.SUCCESS('Done!'))
