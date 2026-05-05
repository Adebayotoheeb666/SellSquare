

const linkArrays = (keys, ...arrays) => {
    const length = arrays[0].length;

    if (!arrays.every((arr) => arr.length === length)) {
        throw new Error("Arrays must have the same length");
    }

    return Array.from({ length }, (_, index) => {
        return arrays.reduce((obj, arr, i) => {
            obj[keys[i]] = arr[index];
            return obj;
        }, {});
    });
};


module.exports = {
    linkArrays,
};

