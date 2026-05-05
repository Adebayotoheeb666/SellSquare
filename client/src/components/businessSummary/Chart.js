import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  defs,
  linearGradient,
  stop,
} from "recharts";
import { useDispatch } from "react-redux";
import { getSalesByYear } from "../../redux/features/product/productSlice";
import useFormatter from "./../../customHook/useFormatter";

const OurChart = ({ sales }) => {
  const dispatch = useDispatch();
  const [chartData, setChartData] = useState([]);
  const currentYear = new Date().getFullYear();

  // useEffect(() => {
  //   dispatch(getSalesByYear(currentYear));
  // }, [dispatch, currentYear]);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];

  // useEffect(() => {
  //   if (sales && sales.data) {
  //     const dataMap = new Map();
  //     sales.data.forEach((data) => {
  //       const month = months[data._id.month - 1];
  //       dataMap.set(month, {
  //         sales: data.totalSales,
  //         profit: data.totalProfit,
  //       });
  //     });

  //     const newChartData = months.map((month) => {
  //       if (dataMap.has(month)) {
  //         return { month, ...dataMap.get(month) };
  //       } else {
  //         return { month, sales: 0, profit: 0 };
  //       }
  //     });

  //     setChartData(newChartData);
  //   }
  // }, [sales]);

  useEffect(() => {
    if (sales && sales.data) {
      const dataMap = new Map();
      sales.data.forEach((data) => {
        const month = months[data._id.month - 1];
        dataMap.set(month, {
          sales: data.totalSales,
          profit: data.totalProfit,
          expenses: data.totalExpenses || 0,
          grossProfit: data.grossProfit || data.totalProfit,
        });
      });

      // Create chart data with zeros for months with no data
      let newChartData = months.map((month) => {
        if (dataMap.has(month)) {
          return { month, ...dataMap.get(month) };
        } else {
          return { month, sales: 0, profit: 0, expenses: 0, grossProfit: 0 };
        }
      });

      // Trim months without data at the beginning and end of the year
      while (
        newChartData.length &&
        newChartData[0].sales === 0 &&
        newChartData[0].profit === 0 &&
        newChartData[0].expenses === 0
      ) {
        newChartData.shift();
      }
      while (
        newChartData.length &&
        newChartData[newChartData.length - 1].sales === 0 &&
        newChartData[newChartData.length - 1].profit === 0 &&
        newChartData[newChartData.length - 1].expenses === 0
      ) {
        newChartData.pop();
      }

      setChartData(newChartData);
    }
  }, [sales]);

  const { formatter } = useFormatter();

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#817AF3" />
              <stop offset="47.92%" stopColor="#74B0FA" />
              <stop offset="100%" stopColor="#79D0F1" />
            </linearGradient>
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#46A46C" />
              <stop offset="47.92%" stopColor="#51CC5D" />
              <stop offset="100%" stopColor="#57DA65" />
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B6B" />
              <stop offset="47.92%" stopColor="#FF8787" />
              <stop offset="100%" stopColor="#FFA3A3" />
            </linearGradient>
          </defs>
          <XAxis dataKey="month" axisLine={false} tickLine={true} />
          <YAxis tickFormatter={formatter} axisLine={false} tickLine={false} />
          <Tooltip formatter={formatter} />
          <Legend
            payload={[
              {
                id: "sales",
                type: "circle",
                value: "Total Sales",
                color: "url(#colorSales)",
              },
              {
                id: "expenses",
                type: "circle",
                value: "Expenses",
                color: "url(#colorExpenses)",
              },
              {
                id: "grossProfit",
                type: "circle",
                value: "Gross Profit",
                color: "url(#colorProfit)",
              },
            ]}
          />
          <Bar
            dataKey="sales"
            fill="url(#colorSales)"
            radius={[40, 40, 0, 0]}
          />
          <Bar
            dataKey="expenses"
            fill="url(#colorExpenses)"
            radius={[40, 40, 0, 0]}
          />
          <Bar
            dataKey="grossProfit"
            fill="url(#colorProfit)"
            radius={[40, 40, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OurChart;

// import React, { useEffect, useState } from "react";
// import Chart from "react-apexcharts";
// import { useDispatch } from "react-redux";
// import { getSalesByYear } from "../../redux/features/product/productSlice";

// const OurChart = ({ sales }) => {
//   const dispatch = useDispatch();
//   const [salesData, setSalesData] = useState([]);
//   const [profitData, setProfitData] = useState([]);
//   const [selectedMonth, setSelectedMonth] = useState([]);

//   useEffect(() => {
//     dispatch(getSalesByYear("2024"));
//   }, [dispatch]);

//   const monthsIds = [
//     "Jan",
//     "Feb",
//     "Mar",
//     "Apr",
//     "May",
//     "Jun",
//     "Jul",
//     "Aug",
//     "Sept",
//     "Oct",
//     "Nov",
//     "Dec",
//   ];

//   useEffect(() => {
//     if (sales && sales.data) {
//       // console.log("Sales data received:", sales.data); // Add this line to log the sales data
//       const newSalesData = [];
//       const newProfitData = [];
//       sales.data.forEach((data) => {
//         newSalesData.push(data.totalSales);
//         newProfitData.push(data.totalProfit);
//       });
//       setSalesData(newSalesData);
//       setProfitData(newProfitData);

//       const newSelectedMonth = monthsIds.slice(
//         sales?.data[0]?._id.month - 1,
//         sales?.data[sales.data.length - 1]?._id.month
//       );
//       setSelectedMonth(newSelectedMonth);
//     }
//   }, [sales]);

//   const formatter = (amount) => {
//     return new Intl.NumberFormat("en-US", {
//       style: "currency",
//       currency: "NGN",
//     }).format(amount);
//   };

//   const state = {
//     options: {
//       colors: ["#79D0F1", "#57DA65"],
//       chart: {
//         id: "basic-bar",
//       },
//       xaxis: {
//         categories: selectedMonth.length > 0 ? selectedMonth : [],
//       },
//       fill: {
//         colors: ["#79D0F1", "#57DA65"],
//         opacity: 1,
//         type: ["#79D0F1", "#57DA65"],
//         gradient: {
//           shade: "dark",
//           type: "vertical",
//           shadeIntensity: 0.5,
//           gradientToColors: undefined,
//           inverseColors: true,
//           opacityFrom: 1,
//           opacityTo: 1,
//           stops: [0, 50, 100],
//           colorStops: ["#817AF3", "#74B0FA", "#79D0F1"],
//         },
//       },
//       plotOptions: {
//         bar: {
//           horizontal: false,
//           columnWidth: "40%",
//         },
//       },
//       dataLabels: {
//         enabled: false,
//       },
//       stroke: {
//         show: true,
//         width: 2,
//         colors: ["transparent"],
//       },
//       tooltip: {
//         y: {
//           formatter: function (val) {
//             return formatter(val);
//           },
//         },
//       },
//     },
//     series: [
//       {
//         name: "Sales",
//         data: salesData,
//       },
//       {
//         name: "Profit",
//         data: profitData,
//       },
//     ],
//   };

//   return (
//     <div style={{ height: "100%", width: "100%" }}>
//       <Chart
//         options={state.options}
//         series={state.series}
//         type="bar"
//         height="100%"
//         width="100%"
//       />
//     </div>
//   );
// };

// export default OurChart;
