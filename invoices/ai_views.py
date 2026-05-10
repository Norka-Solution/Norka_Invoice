"""
NORKA AI Assistant — Claude-powered natural language interface for the invoice system.
Handles Arabic and English commands to create/manage invoices, clients, payments, etc.
"""
import json
import datetime
from decimal import Decimal
from decouple import config

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Company, BankDetails, Client, Invoice, InvoiceItem, Payment

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

RATES = {'AED': 1.0, 'USD': 3.67, 'EUR': 4.01}

# ── Tool definitions ──────────────────────────────────────────────────────────

AI_TOOLS = [
    {
        "name": "list_clients",
        "description": "Get all clients in the system with their IDs, names, and contact info.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "list_companies",
        "description": "Get all companies (senders) in the system with bank accounts.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_invoices",
        "description": "Get existing invoices. Filter by client name, status, or invoice number.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_name":     {"type": "string",  "description": "Part of client name to search"},
                "invoice_number":  {"type": "string",  "description": "Exact invoice number e.g. INV-2026-001"},
                "status": {
                    "type": "string",
                    "enum": ["draft", "sent", "paid", "partially_paid", "overdue", "cancelled", ""],
                },
                "limit": {"type": "integer", "description": "Max invoices to return (default 10)"},
            },
            "required": [],
        },
    },
    {
        "name": "get_invoice_detail",
        "description": "Get full detail of a single invoice including all line items and payment history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_number": {"type": "string", "description": "e.g. INV-2026-001"},
            },
            "required": ["invoice_number"],
        },
    },
    {
        "name": "create_client",
        "description": "Create a new client/customer in the system.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name_en":        {"type": "string", "description": "Client name in English"},
                "name_ar":        {"type": "string", "description": "Client name in Arabic (optional)"},
                "contact_person": {"type": "string"},
                "email":          {"type": "string"},
                "phone":          {"type": "string"},
                "address_en":     {"type": "string"},
                "trn":            {"type": "string", "description": "Tax Registration Number (optional)"},
            },
            "required": ["name_en"],
        },
    },
    {
        "name": "update_client",
        "description": "Update an existing client's information.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id":      {"type": "string"},
                "name_en":        {"type": "string"},
                "name_ar":        {"type": "string"},
                "contact_person": {"type": "string"},
                "email":          {"type": "string"},
                "phone":          {"type": "string"},
                "address_en":     {"type": "string"},
                "trn":            {"type": "string"},
            },
            "required": ["client_id"],
        },
    },
    {
        "name": "delete_client",
        "description": "Delete a client. Will fail if the client has invoices.",
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "UUID of the client to delete"},
            },
            "required": ["client_id"],
        },
    },
    {
        "name": "create_invoice",
        "description": (
            "Create a complete invoice with line items. "
            "Use list_clients and list_companies first to get IDs. "
            "Supports multiple currencies: AED (rate=1), USD (rate=3.67), EUR (rate=4.01)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client_id":       {"type": "string", "description": "UUID of the client"},
                "company_id":      {"type": "string", "description": "UUID of sender company"},
                "bank_details_id": {"type": "string", "description": "UUID of bank account (optional)"},
                "issue_date":      {"type": "string", "description": "YYYY-MM-DD, default today"},
                "due_date":        {"type": "string", "description": "YYYY-MM-DD, default 30 days from today"},
                "period_start":    {"type": "string", "description": "YYYY-MM-DD service period start (optional)"},
                "period_end":      {"type": "string", "description": "YYYY-MM-DD service period end (optional)"},
                "vat_enabled":     {"type": "boolean", "description": "Apply 5% VAT?"},
                "vat_rate":        {"type": "number",  "description": "VAT percentage, default 5.0"},
                "notes_en":        {"type": "string"},
                "notes_ar":        {"type": "string"},
                "items": {
                    "type": "array",
                    "description": "Line items",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description_en": {"type": "string"},
                            "description_ar": {"type": "string"},
                            "quantity":        {"type": "integer"},
                            "unit_price":      {"type": "number"},
                            "currency":        {"type": "string", "enum": ["AED", "USD", "EUR"]},
                            "category": {
                                "type": "string",
                                "enum": ["subscription", "service", "product", "development", "maintenance", "other"],
                            },
                        },
                        "required": ["description_en", "unit_price"],
                    },
                },
            },
            "required": ["client_id", "company_id", "items"],
        },
    },
    {
        "name": "delete_invoice",
        "description": "Delete a draft invoice permanently. Only draft invoices can be deleted.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_number": {"type": "string", "description": "e.g. INV-2026-001"},
            },
            "required": ["invoice_number"],
        },
    },
    {
        "name": "cancel_invoice",
        "description": "Cancel an invoice (sets status to 'cancelled'). Works on sent or overdue invoices.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_number": {"type": "string"},
            },
            "required": ["invoice_number"],
        },
    },
    {
        "name": "duplicate_invoice",
        "description": "Duplicate an existing invoice as a new draft with today's date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_number": {"type": "string"},
            },
            "required": ["invoice_number"],
        },
    },
    {
        "name": "send_invoice",
        "description": "Mark a draft invoice as 'sent' (change status to sent).",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_number": {"type": "string"},
            },
            "required": ["invoice_number"],
        },
    },
    {
        "name": "add_payment",
        "description": "Record a payment received for an invoice.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_number": {"type": "string", "description": "e.g. INV-2026-001"},
                "amount":         {"type": "number"},
                "payment_date":   {"type": "string", "description": "YYYY-MM-DD, default today"},
                "method": {
                    "type": "string",
                    "enum": ["bank_transfer", "cash", "cheque", "other"],
                    "description": "default bank_transfer",
                },
                "reference": {"type": "string"},
            },
            "required": ["invoice_number", "amount"],
        },
    },
    {
        "name": "get_dashboard",
        "description": "Get dashboard statistics: total invoices, paid, overdue, collected this month.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "update_company_info",
        "description": "Update company profile information (name, address, phone, email, TRN, website).",
        "input_schema": {
            "type": "object",
            "properties": {
                "name_en":    {"type": "string"},
                "name_ar":    {"type": "string"},
                "address_en": {"type": "string"},
                "address_ar": {"type": "string"},
                "phone":      {"type": "string"},
                "email":      {"type": "string"},
                "trn":        {"type": "string"},
                "website":    {"type": "string"},
            },
            "required": [],
        },
    },
    {
        "name": "change_password",
        "description": "Change the current user's login password.",
        "input_schema": {
            "type": "object",
            "properties": {
                "new_password": {"type": "string", "description": "The new password (min 6 chars)"},
            },
            "required": ["new_password"],
        },
    },
]

# ── Tool executor ─────────────────────────────────────────────────────────────

def execute_tool(tool_name: str, tool_input: dict, user) -> dict:
    today = datetime.date.today()

    if tool_name == "list_clients":
        clients = Client.objects.all().select_related('company').order_by('name_en')
        return {
            "clients": [
                {
                    "id": str(c.id), "name_en": c.name_en, "name_ar": c.name_ar or "",
                    "contact_person": c.contact_person or "", "email": c.email or "",
                    "phone": c.phone or "", "company": c.company.name_en,
                }
                for c in clients
            ]
        }

    if tool_name == "list_companies":
        companies = Company.objects.prefetch_related('bank_accounts').order_by('name_en')
        return {
            "companies": [
                {
                    "id": str(c.id), "name_en": c.name_en,
                    "bank_accounts": [
                        {"id": str(b.id), "bank_name": b.bank_name,
                         "account_name": b.account_name, "is_default": b.is_default}
                        for b in c.bank_accounts.all()
                    ],
                }
                for c in companies
            ]
        }

    if tool_name == "get_invoices":
        qs = Invoice.objects.select_related('client').order_by('-created_at')
        if tool_input.get('client_name'):
            qs = qs.filter(client__name_en__icontains=tool_input['client_name'])
        if tool_input.get('invoice_number'):
            qs = qs.filter(invoice_number=tool_input['invoice_number'])
        if tool_input.get('status'):
            qs = qs.filter(status=tool_input['status'])
        limit = int(tool_input.get('limit', 10))
        return {
            "invoices": [
                {
                    "id": str(inv.id),
                    "invoice_number": inv.invoice_number,
                    "client": inv.client.name_en,
                    "status": inv.status,
                    "issue_date": str(inv.issue_date),
                    "due_date": str(inv.due_date),
                    "total_aed": str(inv.total_aed),
                    "balance_due": str(inv.balance_due),
                }
                for inv in qs[:limit]
            ]
        }

    if tool_name == "get_invoice_detail":
        try:
            inv = Invoice.objects.select_related('client', 'company').prefetch_related('items', 'payments').get(
                invoice_number=tool_input['invoice_number']
            )
        except Invoice.DoesNotExist:
            return {"error": f"Invoice {tool_input['invoice_number']} not found"}
        return {
            "invoice_number": inv.invoice_number,
            "client": inv.client.name_en,
            "company": inv.company.name_en,
            "status": inv.status,
            "issue_date": str(inv.issue_date),
            "due_date": str(inv.due_date),
            "period_start": str(inv.period_start) if inv.period_start else None,
            "period_end": str(inv.period_end) if inv.period_end else None,
            "vat_enabled": inv.vat_enabled,
            "vat_rate": str(inv.vat_rate),
            "notes_en": inv.notes_en or "",
            "notes_ar": inv.notes_ar or "",
            "total_aed": str(inv.total_aed),
            "balance_due": str(inv.balance_due),
            "items": [
                {
                    "description_en": it.description_en,
                    "description_ar": it.description_ar or "",
                    "quantity": it.quantity,
                    "unit_price": str(it.unit_price),
                    "currency": it.currency,
                    "exchange_rate": str(it.exchange_rate),
                    "category": it.category,
                    "line_total_aed": str(it.quantity * it.unit_price * it.exchange_rate),
                }
                for it in inv.items.all().order_by('sort_order')
            ],
            "payments": [
                {
                    "amount": str(p.amount),
                    "payment_date": str(p.payment_date),
                    "method": p.method,
                    "reference": p.reference or "",
                }
                for p in inv.payments.all().order_by('payment_date')
            ],
        }

    if tool_name == "create_client":
        company = Company.objects.first()
        if not company:
            return {"error": "No company found in the system"}
        client = Client.objects.create(
            company=company,
            name_en=tool_input['name_en'],
            name_ar=tool_input.get('name_ar', ''),
            contact_person=tool_input.get('contact_person', ''),
            email=tool_input.get('email', ''),
            phone=tool_input.get('phone', ''),
            address_en=tool_input.get('address_en', ''),
            trn=tool_input.get('trn', ''),
        )
        return {"success": True, "client_id": str(client.id), "name": client.name_en}

    if tool_name == "update_client":
        try:
            client = Client.objects.get(id=tool_input['client_id'])
        except Client.DoesNotExist:
            return {"error": "Client not found"}
        for field in ['name_en', 'name_ar', 'contact_person', 'email', 'phone', 'address_en', 'trn']:
            if field in tool_input:
                setattr(client, field, tool_input[field])
        client.save()
        return {"success": True, "client_id": str(client.id), "name": client.name_en}

    if tool_name == "delete_client":
        try:
            client = Client.objects.get(id=tool_input['client_id'])
        except Client.DoesNotExist:
            return {"error": "Client not found"}
        name = client.name_en
        try:
            client.delete()
            return {"success": True, "message": f"Client '{name}' deleted"}
        except Exception as e:
            return {"error": f"Cannot delete client: {str(e)}"}

    if tool_name == "create_invoice":
        try:
            client = Client.objects.get(id=tool_input['client_id'])
            company = Company.objects.get(id=tool_input['company_id'])
        except (Client.DoesNotExist, Company.DoesNotExist) as e:
            return {"error": str(e)}

        issue_date = tool_input.get('issue_date') or str(today)
        due_date   = tool_input.get('due_date')   or str(today + datetime.timedelta(days=30))

        bank = None
        if tool_input.get('bank_details_id'):
            bank = BankDetails.objects.filter(id=tool_input['bank_details_id']).first()
        if not bank:
            bank = BankDetails.objects.filter(company=company, is_default=True).first()

        vat_rate = Decimal(str(tool_input.get('vat_rate', '5.00')))

        invoice = Invoice.objects.create(
            company=company,
            client=client,
            issue_date=issue_date,
            due_date=due_date,
            period_start=tool_input.get('period_start') or None,
            period_end=tool_input.get('period_end') or None,
            vat_enabled=tool_input.get('vat_enabled', False),
            vat_rate=vat_rate,
            notes_en=tool_input.get('notes_en', ''),
            notes_ar=tool_input.get('notes_ar', ''),
            bank_details=bank,
            created_by=user,
        )

        for i, item in enumerate(tool_input.get('items', [])):
            currency = item.get('currency', 'AED')
            exchange_rate = Decimal(str(RATES.get(currency, 1.0)))
            InvoiceItem.objects.create(
                invoice=invoice,
                description_en=item['description_en'],
                description_ar=item.get('description_ar', ''),
                quantity=int(item.get('quantity', 1)),
                unit_price=Decimal(str(item['unit_price'])),
                currency=currency,
                exchange_rate=exchange_rate,
                category=item.get('category', 'service'),
                sort_order=i,
            )

        return {
            "success": True,
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "client": client.name_en,
            "total_aed": str(invoice.total_aed),
            "status": invoice.status,
            "issue_date": str(invoice.issue_date),
            "due_date": str(invoice.due_date),
            "items_count": invoice.items.count(),
        }

    if tool_name == "delete_invoice":
        try:
            invoice = Invoice.objects.get(invoice_number=tool_input['invoice_number'])
        except Invoice.DoesNotExist:
            return {"error": f"Invoice {tool_input['invoice_number']} not found"}
        if invoice.status != 'draft':
            return {"error": f"Cannot delete invoice with status '{invoice.status}'. Only draft invoices can be deleted."}
        num = invoice.invoice_number
        invoice.delete()
        return {"success": True, "message": f"Invoice {num} deleted"}

    if tool_name == "cancel_invoice":
        try:
            invoice = Invoice.objects.get(invoice_number=tool_input['invoice_number'])
        except Invoice.DoesNotExist:
            return {"error": f"Invoice {tool_input['invoice_number']} not found"}
        if invoice.status in ('paid',):
            return {"error": f"Cannot cancel a paid invoice"}
        invoice.status = 'cancelled'
        invoice.save(update_fields=['status'])
        return {"success": True, "invoice_number": invoice.invoice_number, "status": "cancelled"}

    if tool_name == "duplicate_invoice":
        try:
            original = Invoice.objects.prefetch_related('items').get(invoice_number=tool_input['invoice_number'])
        except Invoice.DoesNotExist:
            return {"error": f"Invoice {tool_input['invoice_number']} not found"}
        new_inv = Invoice.objects.create(
            company=original.company,
            client=original.client,
            issue_date=today,
            due_date=today + datetime.timedelta(days=30),
            period_start=original.period_start,
            period_end=original.period_end,
            vat_enabled=original.vat_enabled,
            vat_rate=original.vat_rate,
            notes_en=original.notes_en,
            notes_ar=original.notes_ar,
            bank_details=original.bank_details,
            created_by=user,
        )
        for item in original.items.all():
            InvoiceItem.objects.create(
                invoice=new_inv,
                description_en=item.description_en,
                description_ar=item.description_ar,
                quantity=item.quantity,
                unit_price=item.unit_price,
                currency=item.currency,
                exchange_rate=item.exchange_rate,
                category=item.category,
                sort_order=item.sort_order,
            )
        return {
            "success": True,
            "original": original.invoice_number,
            "new_invoice_number": new_inv.invoice_number,
            "new_invoice_id": str(new_inv.id),
            "client": new_inv.client.name_en,
            "total_aed": str(new_inv.total_aed),
        }

    if tool_name == "send_invoice":
        try:
            invoice = Invoice.objects.get(invoice_number=tool_input['invoice_number'])
        except Invoice.DoesNotExist:
            return {"error": f"Invoice {tool_input['invoice_number']} not found"}
        if invoice.status == 'draft':
            invoice.status = 'sent'
            invoice.save(update_fields=['status'])
        return {"success": True, "invoice_number": invoice.invoice_number, "status": invoice.status}

    if tool_name == "add_payment":
        try:
            invoice = Invoice.objects.get(invoice_number=tool_input['invoice_number'])
        except Invoice.DoesNotExist:
            return {"error": f"Invoice {tool_input['invoice_number']} not found"}
        payment_date = tool_input.get('payment_date') or str(today)
        payment = Payment.objects.create(
            invoice=invoice,
            amount=Decimal(str(tool_input['amount'])),
            payment_date=payment_date,
            method=tool_input.get('method', 'bank_transfer'),
            reference=tool_input.get('reference', ''),
        )
        invoice.refresh_from_db()
        return {
            "success": True,
            "payment_id": str(payment.id),
            "invoice_number": invoice.invoice_number,
            "amount_paid": str(payment.amount),
            "balance_due": str(invoice.balance_due),
            "new_status": invoice.status,
        }

    if tool_name == "get_dashboard":
        from django.db.models import Sum
        first_day = today.replace(day=1)
        invoices = Invoice.objects.all()
        paid_month = Payment.objects.filter(payment_date__gte=first_day).aggregate(s=Sum('amount'))['s'] or 0
        return {
            "total_invoices":            invoices.count(),
            "draft":                     invoices.filter(status='draft').count(),
            "sent":                      invoices.filter(status='sent').count(),
            "paid":                      invoices.filter(status='paid').count(),
            "partially_paid":            invoices.filter(status='partially_paid').count(),
            "overdue":                   invoices.filter(status='overdue').count(),
            "cancelled":                 invoices.filter(status='cancelled').count(),
            "collected_this_month_aed":  float(paid_month),
            "today":                     str(today),
        }

    if tool_name == "update_company_info":
        company = Company.objects.first()
        if not company:
            return {"error": "No company found in the system"}
        fields = ['name_en', 'name_ar', 'address_en', 'address_ar', 'phone', 'email', 'trn', 'website']
        for field in fields:
            if field in tool_input:
                setattr(company, field, tool_input[field])
        company.save()
        return {"success": True, "company": company.name_en}

    if tool_name == "change_password":
        new_password = tool_input.get('new_password', '')
        if len(new_password) < 6:
            return {"error": "Password must be at least 6 characters"}
        user.set_password(new_password)
        user.save()
        return {"success": True, "message": "Password changed successfully"}

    return {"error": f"Unknown tool: {tool_name}"}


# ── System prompt ─────────────────────────────────────────────────────────────

def build_system_prompt():
    today = datetime.date.today()
    return f"""You are NORKA AI, the intelligent assistant for NORKA Solution's invoice management system.
Today's date is {today.strftime('%Y-%m-%d')} ({today.strftime('%A, %d %B %Y')}).

You speak both Arabic and English fluently — always reply in the same language the user used.
You are professional, efficient, and action-oriented.

YOUR FULL CAPABILITIES:
- Create invoices from natural language descriptions
- Delete and cancel invoices
- Duplicate existing invoices
- Mark invoices as sent
- Create, update, and delete clients
- Record payments against invoices
- View dashboard statistics and full invoice details
- Update company profile
- Change the login password

INVOICE CREATION RULES:
1. Always call list_clients and list_companies FIRST to get IDs
2. If the client doesn't exist, use create_client first
3. Use the company's default bank account automatically
4. Default: issue_date = today, due_date = 30 days from today
5. For service periods (e.g., "March 2026"), set period_start and period_end
6. Always confirm with a clear summary after creating

CURRENCY & EXCHANGE RATES (fixed):
- AED: rate = 1.0 (base currency — all totals in AED)
- USD: rate = 3.67
- EUR: rate = 4.01

SERVICE CATEGORIES:
- Monthly retainers / subscriptions → "subscription"
- Hosting (Render, AWS, DigitalOcean) → "service"
- Development work → "development"
- Support & maintenance → "maintenance"
- Travel/flights → "other"
- Products → "product"
- General services → "service"

BEHAVIOR RULES:
- When the user says "charge X 2000 AED/month" → quantity=1, unit_price=2000, category=subscription
- Multiple charges in one message → multiple line items in one invoice
- Ask for clarification ONLY when a required value is truly unknown
- After creating an invoice: show invoice number, client, line items, total AED, and due date
- After recording a payment: show amount paid, new balance, and new status
- Be concise — do, don't discuss
- Reply in the user's language (Arabic if they wrote Arabic, English if English)

NORKA SOLUTION context:
- IT company based in Abu Dhabi, UAE
- Services: software development, subscriptions, hosting, IT support
- Default VAT: 5% (disabled by default — ask user if they want VAT)
- Invoice format: INV-YYYY-NNN
"""


# ── Main AI view ──────────────────────────────────────────────────────────────

class AIChatView(APIView):
    def post(self, request):
        if not ANTHROPIC_AVAILABLE:
            return Response(
                {"error": "Anthropic package not installed. Run: pip install anthropic"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        api_key = config('ANTHROPIC_API_KEY', default='')
        if not api_key or api_key == 'your-anthropic-api-key-here':
            return Response(
                {
                    "error": "ANTHROPIC_API_KEY not configured",
                    "reply": (
                        "⚠️ Please add your Anthropic API key to the .env file:\n"
                        "ANTHROPIC_API_KEY=sk-ant-...\n\n"
                        "Get your key at: https://console.anthropic.com"
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        messages = request.data.get('messages', [])
        if not messages:
            return Response({"error": "No messages provided"}, status=status.HTTP_400_BAD_REQUEST)

        client_sdk = anthropic.Anthropic(api_key=api_key)
        actions_taken = []
        current_messages = list(messages)

        for _ in range(15):
            response = client_sdk.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=build_system_prompt(),
                tools=AI_TOOLS,
                messages=current_messages,
            )

            if response.stop_reason == 'end_turn':
                reply_text = ''.join(
                    block.text for block in response.content if hasattr(block, 'text')
                )
                return Response({"reply": reply_text, "actions": actions_taken})

            if response.stop_reason == 'tool_use':
                current_messages.append({
                    "role": "assistant",
                    "content": response.content,
                })

                tool_results = []
                for block in response.content:
                    if block.type != 'tool_use':
                        continue
                    tool_result = execute_tool(block.name, block.input, request.user)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(tool_result, ensure_ascii=False),
                    })
                    if tool_result.get('success'):
                        action_map = {
                            'create_invoice':    {"type": "invoice_created",   "invoice_id": tool_result.get('invoice_id'),   "invoice_number": tool_result.get('invoice_number')},
                            'delete_invoice':    {"type": "invoice_deleted"},
                            'cancel_invoice':    {"type": "invoice_cancelled", "invoice_number": tool_result.get('invoice_number')},
                            'duplicate_invoice': {"type": "invoice_duplicated","invoice_number": tool_result.get('new_invoice_number')},
                            'send_invoice':      {"type": "invoice_sent",      "invoice_number": tool_result.get('invoice_number')},
                            'create_client':     {"type": "client_created",    "client_id": tool_result.get('client_id'),     "name": tool_result.get('name')},
                            'update_client':     {"type": "client_updated",    "name": tool_result.get('name')},
                            'delete_client':     {"type": "client_deleted"},
                            'add_payment':       {"type": "payment_recorded",  "invoice_number": tool_result.get('invoice_number'), "amount": tool_result.get('amount_paid')},
                        }
                        if block.name in action_map:
                            actions_taken.append(action_map[block.name])

                current_messages.append({"role": "user", "content": tool_results})
                continue

            break

        return Response({"reply": "I processed your request.", "actions": actions_taken})
