
const immutable = {
    enumerable  : true,
    writtable   : false,
    configurable: false
};

const selectors = Object.defineProperties(
    {},
    {
        email: {
            value: '#Input_Username',
            ...immutable
        },
        password: {
            value: '#Input_Password',
            ...immutable
        },
        logIn: {
            value: '.btn.btn-primary',
            ...immutable
        },
        packing: {
            value: '#menu-packing-link',
            ...immutable
        },
        logOut: {
            value: '[href="/Account/Logout"]',
            ...immutable
        },
        freeLocation: {
            value: '.btn.btn-light.btn-block',
            ...immutable
        },
        takenLocation: {
            value: '.btn.btn-light.btn-block.confirm',
            ...immutable
        },
        pickedOrder: {
            value: '.btn.btn-light.btn-block',
            ...immutable
        },
        confirmOrder: {
            value: '[href="/Packing/Parcels"]',
            ...immutable
        },
        confirmParcels: {
            value: '#confirm-parcels',
            ...immutable
        },
        parcelWeightInput: {
            value: '.form-control.parcel-weight',
            ...immutable
        },
        printLabel: {
            value: '.btn.btn-primary.btn-print-label',
            ...immutable
        },
        finishPacking: {
            value: '#btn-end-packing',
            ...immutable
        }
    }
);

module.exports = selectors;
