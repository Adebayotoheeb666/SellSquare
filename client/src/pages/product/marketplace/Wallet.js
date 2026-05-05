import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import "./Marketplace.scss";
import businessWalletService from "../../../services/businessWalletService";
import { toast } from "sonner";

const MarketplaceWallet = () => {
  const [balance, setBalance] = useState(0);
  const [currency, setCurrency] = useState("NGN");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdraw, setWithdraw] = useState({
    amount: "",
    bankCode: "",
    accountNumber: "",
    accountName: "",
  });

  const loadWallet = async () => {
    try {
      setLoading(true);
      const [balanceRes, txRes] = await Promise.all([
        businessWalletService.getBalance(),
        businessWalletService.getTransactions(),
      ]);

      setBalance(Number(balanceRes?.data?.data?.balance || 0));
      setCurrency(balanceRes?.data?.data?.currency || "NGN");
      setTransactions(txRes?.data?.data || []);
    } catch (error) {
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, []);

  const handleWithdrawChange = (event) => {
    const { name, value } = event.target;
    setWithdraw((prev) => ({ ...prev, [name]: value }));
  };

  const handleWithdraw = async (event) => {
    event.preventDefault();
    const amount = Number(withdraw.amount || 0);

    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > balance) {
      toast.error("Amount exceeds available balance");
      return;
    }
    if (!withdraw.bankCode.trim() || !withdraw.accountNumber.trim() || !withdraw.accountName.trim()) {
      toast.error("Please complete bank details");
      return;
    }

    try {
      setSubmitting(true);
      await businessWalletService.requestWithdrawal({
        amount,
        bankCode: withdraw.bankCode.trim(),
        accountNumber: withdraw.accountNumber.trim(),
        accountName: withdraw.accountName.trim(),
      });
      toast.success("Withdrawal request submitted");
      setWithdraw({
        amount: "",
        bankCode: "",
        accountNumber: "",
        accountName: "",
      });
      setShowWithdrawForm(false);
      setTransactionsLoading(true);
      await loadWallet();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Withdrawal request failed");
    } finally {
      setSubmitting(false);
      setTransactionsLoading(false);
    }
  };

  return (
    <div className="marketplace-page">
      <Helmet>
        <title>Marketplace Wallets | Sell Square</title>
        <meta
          name="description"
          content="Review balances and payouts for marketplace sales in Sell Square."
        />
      </Helmet>

      <div className="marketplace-header">
        <h1>Wallet</h1>
        <p>Review balances, payouts, and marketplace transaction history.</p>
      </div>

      <div className="marketplace-panel">
        {loading ? (
          <p>Loading wallet data...</p>
        ) : (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 6 }}>Available Balance</h3>
              <p style={{ fontSize: 24, fontWeight: 700 }}>
                {currency} {balance.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <button
                type="button"
                className="submit-button"
                onClick={() => setShowWithdrawForm((prev) => !prev)}
                style={{ maxWidth: 240 }}
              >
                {showWithdrawForm ? "Cancel Withdrawal" : "Withdraw Funds"}
              </button>
            </div>

            {showWithdrawForm && (
              <form onSubmit={handleWithdraw} style={{ marginBottom: 20 }}>
                <h3 style={{ marginBottom: 8 }}>Request Withdrawal</h3>
                <div style={{ display: "grid", gap: 10, maxWidth: 480 }}>
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount"
                    value={withdraw.amount}
                    onChange={handleWithdrawChange}
                    disabled={submitting}
                  />
                  <input
                    name="bankCode"
                    type="text"
                    placeholder="Bank code (e.g. 044)"
                    value={withdraw.bankCode}
                    onChange={handleWithdrawChange}
                    disabled={submitting}
                  />
                  <input
                    name="accountNumber"
                    type="text"
                    placeholder="Account number"
                    value={withdraw.accountNumber}
                    onChange={handleWithdrawChange}
                    disabled={submitting}
                  />
                  <input
                    name="accountName"
                    type="text"
                    placeholder="Account name"
                    value={withdraw.accountName}
                    onChange={handleWithdrawChange}
                    disabled={submitting}
                  />
                  <button type="submit" className="submit-button" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Withdrawal"}
                  </button>
                </div>
              </form>
            )}

            <div>
              <h3 style={{ marginBottom: 8 }}>Transaction History</h3>
              {transactionsLoading ? (
                <p>Refreshing transactions...</p>
              ) : transactions.length === 0 ? (
                <p>No wallet activity yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {transactions.map((tx, index) => (
                    <div key={`${tx.reference || tx.createdAt || "tx"}-${index}`} className="marketplace-empty" style={{ textAlign: "left" }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>{tx.reason || "Wallet transaction"}</p>
                      <p style={{ margin: "4px 0" }}>
                        {tx.type === "credit" ? "+" : "-"} {currency} {Number(tx.amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <small>
                        {tx.status || "completed"} {tx.reference ? `• Ref: ${tx.reference}` : ""}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceWallet;
