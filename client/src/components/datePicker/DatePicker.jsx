import React, { useRef } from 'react';

const DatePicker = ({handleDateChange, name, dateInputRef}) => {

//   const handleDateChange = () => {
//     console.log('Selected Date:', dateInputRef.current.value);
//   };

  return (
    <div>
      <input
        type="date"
        className="date_picker_input"
        name={name}
        ref={dateInputRef}
        // style={{ display: 'none' }}
        onChange={handleDateChange}
      />
      {/* <input
        type="text"
        id="customDate"
        placeholder="DD-MM-YY"
        // readOnly
        onClick={() => dateInputRef.current.click()} // Trigger date input click
      /> */}
    </div>
  );
};

export default DatePicker;
