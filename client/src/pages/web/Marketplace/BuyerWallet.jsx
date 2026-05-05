import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  fetchBuyerWalletBalance,
  fetchBuyerWalletTransactions,
  withdrawFromWallet,
  selectBuyerWalletBalance,
  selectBuyerWalletCurrency,
  selectBuyerWalletLoading,
  selectBuyerWalletError,
  selectBuyerWalletTransactions,
  selectBuyerWalletTransactionsLoading,
  selectBuyerWalletWithdrawLoading,
  selectBuyerWalletWithdrawError,
  clearError,
  clearWithdrawError,
} from "../../../redux/features/buyerWallet/buyerWalletSlice";
import { useBuyerRealtime } from "../../../customHook/useBuyerRealtime";
import "./BuyerWallet.scss";

/**
 * BuyerWallet Component
 * Displays buyer wallet balance and transaction history
 */
const BuyerWallet = () => {
  const dispatch = useDispatch();
  const balance = useSelector(selectBuyerWalletBalance);
  const currency = useSelector(selectBuyerWalletCurrency);
  const loading = useSelector(selectBuyerWalletLoading);
  const error = useSelector(selectBuyerWalletError);
  const transactions = useSelector(selectBuyerWalletTransactions);
  const transactionsLoading = useSelector(selectBuyerWalletTransactionsLoading);
  const withdrawLoading = useSelector(selectBuyerWalletWithdrawLoading);
  const withdrawError = useSelector(selectBuyerWalletWithdrawError);

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Initialize buyer realtime notifications
  useBuyerRealtime();

  useEffect(() => {
    dispatch(fetchBuyerWalletBalance());
    dispatch(fetchBuyerWalletTransactions({ page: currentPage }));
  }, [dispatch, currentPage]);

  const handleWithdraw = (e) => {
    e.preventDefault();

    if (!withdrawAmount || !bankName || !accountNumber || !accountName) {
      alert("Please fill in all fields");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (amount <= 0 || amount > balance) {
      alert("Invalid withdrawal amount");
      return;
    }

    dispatch(
      withdrawFromWallet({
        amount,
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      })
    ).then((result) => {
      if (!result.payload || result.payload.error) {
        // Error will be shown via withdrawError selector
      } else {
        setWithdrawAmount("");
        setBankName("");
        setAccountNumber("");
        setAccountName("");
        setShowWithdrawForm(false);
        dispatch(fetchBuyerWalletBalance());
      }
    });
  };

  const getTransactionBadgeClass = (type) => {
    return type === "credit" ? "transaction-credit" : "transaction-debit";
  };
  return (
    <div className="buyer-wallet-container">
      <Link to="/marketplace/buyer/orders" className="back-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>
      <div className="wallet-header">
        <h1>My Wallet</h1>
        <p>Manage your funds and transaction history</p>
      </div>

      {error && (
        <div className="error-alert">
          <span>{error}</span>
          <button onClick={() => dispatch(clearError())}>Dismiss</button>
        </div>
      )}

      {withdrawError && (
        <div className="error-alert">
          <span>{withdrawError}</span>
          <button onClick={() => dispatch(clearWithdrawError())}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading wallet...</p>
        </div>
      ) : (
        <>
          <div className="wallet-balance-card">
            <h2>Available Balance</h2>
            <div className="balance-amount">
              <span className="amount">
                {currency} {balance.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <button
              className="withdraw-button"
              onClick={() => setShowWithdrawForm(!showWithdrawForm)}
            >
              {showWithdrawForm ? "Cancel" : "Withdraw Funds"}
            </button>
          </div>

          {showWithdrawForm && (
            <form className="withdraw-form" onSubmit={handleWithdraw}>
              <h3>Withdraw Funds</h3>

              <div className="form-group">
                <label htmlFor="amount">Amount to Withdraw ({currency})</label>
                <input
                  type="number"
                  id="amount"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  max={balance}
                  required
                  disabled={withdrawLoading}
                />
                <small>Available: {currency} {balance.toLocaleString()}</small>
              </div>

              <div className="form-group">
                <label htmlFor="bankName">Bank Name *</label>
                <input
                  type="text"
                  id="bankName"
                  placeholder="e.g., Zenith Bank, GTBank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  required
                  disabled={withdrawLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="accountNumber">Account Number *</label>
                <input
                  type="text"
                  id="accountNumber"
                  placeholder="Enter your account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  required
                  disabled={withdrawLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="accountName">Account Name *</label>
                <input
                  type="text"
                  id="accountName"
                  placeholder="Name as it appears in the bank"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  required
                  disabled={withdrawLoading}
                />
              </div>

              <button
                type="submit"
                className="submit-button"
                disabled={withdrawLoading}
              >
                {withdrawLoading ? "Processing..." : "Confirm Withdrawal"}
              </button>
            </form>
          )}

          <div className="transactions-section">
            <div className="transactions-header-row">
              <h2>Transaction History</h2>
              <Link to="/marketplace/buyer/transactions" className="view-all-link">
                View All
              </Link>
            </div>

            {transactionsLoading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading transactions...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="empty-state">
                <p>No transactions yet</p>
              </div>
            ) : (
              <>
                <div className="transactions-list">
                  {transactions.slice(0, 5).map((transaction, index) => (
                    <div key={index} className="transaction-item">
                      <div className="transaction-info">
                        <p className="transaction-reason">{transaction.reason}</p>
                        <p className="transaction-date">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`transaction-amount ${getTransactionBadgeClass(transaction.type)}`}>
                        {transaction.type === "credit" ? "+" : "-"}
                        {currency} {transaction.amount.toLocaleString("en-NG", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BuyerWallet;
