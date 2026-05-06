from dataclasses import dataclass
from app.config import get_settings


@dataclass
class FeeBreakdown:
    sale_price_cad: int
    total_fee_cad: int
    deposit_cad: int
    balance_cad: int

    @property
    def total_fee_cents(self) -> int:
        return self.total_fee_cad * 100

    @property
    def deposit_cents(self) -> int:
        return self.deposit_cad * 100

    @property
    def balance_cents(self) -> int:
        return self.balance_cad * 100


def compute_fees(sale_price_cad: int) -> FeeBreakdown:
    """
    Calcule les frais Logeo selon la règle :
    - frais totaux = sale_price * fee_percent
    - dépôt = max(sale_price * fee_percent * deposit_percent_of_fee / 10000, deposit_minimum)
    - solde = total - dépôt

    Exemples :
      800 000$ -> total 8 000$, dépôt 2 500$ (plancher), solde 5 500$
      1 200 000$ -> total 12 000$, dépôt 3 000$, solde 9 000$
    """
    s = get_settings()
    total = round(sale_price_cad * s.fee_percent / 100)
    raw_deposit = round(total * s.deposit_percent_of_fee / 100)
    deposit = max(raw_deposit, s.deposit_minimum_cad)
    if deposit > total:
        deposit = total
    balance = total - deposit
    return FeeBreakdown(
        sale_price_cad=sale_price_cad,
        total_fee_cad=total,
        deposit_cad=deposit,
        balance_cad=balance,
    )
