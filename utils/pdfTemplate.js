const moment = require("moment");

const receiptTemplate = ({
  data,
  business,
  logo,
  businessAddress,
  businessPhone,
  customer,
  orderId,
}) => {
  const today = new Date();
  const formatter = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const format = "DD-MM-YYYY h:mmA";
  const formattedDate = moment(data.createdAt).format(format);

  let subTotal = 0;

  const array = [];

  if (data && data.items) {
    data.items.map((item) => {
      const { price, quantity } = item;
      const cartValue = price * quantity;
      return array.push(cartValue);
    });
    const totalValue = array.reduce((a, b) => {
      return a + b;
    }, 0);
    subTotal = totalValue;
  }

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @import url("https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap");

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: Poppins;
        }

        html,
        body {
          width: 100%;
          border-radius: 10px;
          display: flex;
          margin: 0;
          padding: 0;
        }

        .receipt-container {
          width: 100%;
          border-radius: 10px;
          background: #fff;
          padding: 20px;
          margin: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header .business_logo {
          width: 70px;
          height: 70px;
        }

        .header .business_logo img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          /* object-fit: cover; */
        }

        .header .business_info {
          text-align: right;
        }

        .header h1 {
          font-size: 36px; /* 24px * 1.5 */
          font-weight: 500;
          line-height: 51px; /* 34px * 1.5 */
        }

        .header h5 {
          font-size: 24px; /* 16px * 1.5 */
          font-weight: 300;
          line-height: 31.5px; /* 21px * 1.5 */
          letter-spacing: 0em;
        }

        .receipt-details h1 {
          font-size: 36px; /* 24px * 1.5 */
          font-weight: 400;
          line-height: 51px; /* 34px * 1.5 */
          margin: 40px 0;
          text-align: center;
        }

        .other-infos {
          margin: 40px 0;
        }

        .other-infos p {
          font-size: 24px; /* 16px * 1.5 */
          font-weight: 400;
          line-height: 31.5px; /* 21px * 1.5 */
          letter-spacing: 0em;
          text-align: left;
        }

        .products {
          margin: 50px 0;
        }

        .products table {
          width: 100%;
        }

        .products table tr {
          width: 100%;
          border-bottom: 1px solid #c9c9c9 !important;
        }

        .products table td:nth-child(1) {
          text-align: left;
        }

        .products table td:nth-child(4) {
          text-align: right;
        }

        .products table th:nth-child(4) {
          text-align: right;
        }

        .products table th:nth-child(1) {
          text-align: left;
        }

        .products tr th,
        .products tr td {
          text-align: center;
        }

        .products table tr td,
        .products table tr th {
          font-size: 24px; /* 16px * 1.5 */
          font-weight: 400;
          padding: 24px 0; /* 16px * 1.5 */
          line-height: 31.5px; /* 21px * 1.5 */
          border-bottom: 1px solid #c9c9c9 !important;
        }

        .summary {
          margin: 40px 0;
        }

        .summary p {
          font-size: 24px; /* 16px * 1.5 */
          font-weight: 400;
          line-height: 31.5px; /* 21px * 1.5 */
          letter-spacing: 0em;
          margin-bottom: 25px;
        }

        .summary table {
          width: 100%;
        }

        .summary table tr {
          width: 100%;
        }

        .summary table tr td:nth-child(2) {
          text-align: right;
        }

        .summary table tr td {
          font-size: 21px; /* 14px * 1.5 */
          font-weight: 400;
          line-height: 31.5px; /* 21px * 1.5 */
          border: none;
        }

        .receipt-container>p {
          text-align: center;
          font-size: 18px; /* 12px * 1.5 */
          font-weight: 400;
          line-height: 27px; /* 18px * 1.5 */
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
            <div class="business_logo">
                <img src=${logo} alt="" />
            </div>
            <div class="business_info">
                <h1>${business}</h1>
                <h5>${businessAddress}</h5>
                <h5>${businessPhone}</h5>
            </div>
        </div>
        <div class="receipt-details">
          <h1>Receipt</h1>
          <div class="other-infos">
            <p>Date: ${formattedDate}</p>
            <p>Sold By: ${data.user.name}</p>
            <p>Customer: ${customer.name}</p>
          </div>
          <h1>Order ID: ${orderId}</h1>
          <div class="products">
            <table>
              <tr>
                <th>Item(s)</th>
                <th>Price</th>
                <th>Qty</th>
                <th>value</th>
              </tr>
              ${data?.items?.map((item, index) => {
                return `<tr key=${index}>
                      <td>${item?.name}</td>
                      <td>${formatter(item?.price)}</td>
                      <td>${item?.quantity}</td>
                      <td>${formatter(item?.quantity * item?.price)}</td>
                  </tr>`;
              })}
            </table>
            <div class="summary">
              <p>Total no of items: ${data?.items?.length}</p>
              <table>
                <tr>
                  <td>Subtotal</td>
                  <td>${formatter(subTotal)}</td>
                </tr>
                <tr>
                  <td>VAT</td>
                  <td>NGN 0.00</td>
                </tr>
                <tr>
                  <td>Total</td>
                  <td>${formatter(subTotal)}</td>
                </tr>
              </table>
            </div>
          </div>
        </div>
        <p>Goods sold under good conditions are not returnable.</p>
      </div>
    </body>
  </html>
  `;
};

module.exports = { receiptTemplate };