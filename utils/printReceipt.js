const escpos = require("@node-escpos/core");
const USB = require("@node-escpos/usb-adapter");

function formatCurrency(value) {
  return `NGN ${value.toFixed(2)}`;
}

async function printReceipt(checkout) {
  const devices = USB.findPrinter();
  console.log("Devices found:", devices);

  if (devices.length === 0) {
    throw new Error("No printers found. Please connect a printer.");
  }

  let device = new USB();
  // try {
  //   device = new USB();
  // } catch (error) {
  //   console.log(error);
  //   throw new Error(error.message);
  // }

  const options = { encoding: "GB18030" };
  const printer = new escpos.Printer(device, options);

  function safePrintln(text) {
    if (text !== undefined && text !== null) {
      printer.text(text.toString() + "\n");
    } else {
      printer.text(".....................\n");
    }
  }

  try {
    // Open the printer device
    await device.open();

    const { businessAddress, businessPhone, user, customer, items } = checkout;
    const subTotal = 600;

    printer.align("CT");
    printer.style("B");
    safePrintln("..........................");
    safePrintln("..........................");
    printer.style("NORMAL");
    safePrintln(businessAddress);
    safePrintln(businessPhone);
    printer.drawLine();

    safePrintln("Receipt");
    printer.drawLine();

    printer.align("LT");
    safePrintln(`Date: ${new Date().toLocaleString()}`);
    safePrintln(`Employee: ${user ? user.name : "Unknown"}`);
    safePrintln(`Customer: ${customer ? customer.name : "Unknown"}`);
    printer.drawLine();

    // Print table headers
    printer.table([
      { text: "Item(s)", align: "LEFT", width: 0.4 },
      { text: "Price", align: "LEFT", width: 0.2 },
      { text: "Qty", align: "CENTER", width: 0.2 },
      { text: "Value", align: "RIGHT", width: 0.2 },
    ]);

    // Print items
    if (items && items.length > 0) {
      items.forEach((item) => {
        printer.table([
          { text: item.name || "N/A", align: "LEFT", width: 0.4 },
          { text: formatCurrency(item.price || 0), align: "LEFT", width: 0.2 },
          {
            text: item.quantity ? item.quantity.toString() : "0",
            align: "CENTER",
            width: 0.2,
          },
          {
            text: formatCurrency((item.quantity || 0) * (item.price || 0)),
            align: "RIGHT",
            width: 0.2,
          },
        ]);
      });
    } else {
      safePrintln("No items to display");
    }

    printer.drawLine();
    safePrintln(`Total no of items: ${items ? items.length : 0}`);

    // Print summary
    printer.table([
      { text: "Subtotal", align: "LEFT", width: 0.7 },
      { text: formatCurrency(subTotal), align: "RIGHT", width: 0.3 },
    ]);
    printer.table([
      { text: "VAT", align: "LEFT", width: 0.7 },
      { text: "NGN 0.00", align: "RIGHT", width: 0.3 },
    ]);
    printer.table([
      { text: "Total", align: "LEFT", width: 0.7 },
      { text: formatCurrency(subTotal), align: "RIGHT", width: 0.3 },
    ]);

    printer.drawLine();
    safePrintln("Goods sold under good conditions are not returnable.");

    printer.cut();

    printer.close();

    console.log("Receipt printed successfully!!!");
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
}

module.exports = {
  printReceipt,
};
