import { MemoryAdapter } from './TestMemoryAdapter';
import { QueryExpression } from '../src';
import Customers from './test/config/models/Customer.json';
import Categories from './test/config/models/Category.json';
import Shippers from './test/config/models/Shipper.json';
import Suppliers from './test/config/models/Supplier.json';
import Employees from './test/config/models/Employee.json';
import Products from './test/config/models/Product.json';
import Orders from './test/config/models/Order.json';
import OrderDetails from './test/config/models/OrderDetail.json';

async function migrateAsync(model) {
    const db = new MemoryAdapter();
    try {
        const migrateAsyncData = {
            version: model.version,
            appliesTo: model.source,
            model: model.name,
            add: model.fields
        };
        await db.migrateAsync(migrateAsyncData);
        if (migrateAsyncData.updated === true) {
            await db.closeAsync();
            return;
        }
        let item;
        for(let i = 0; i < model.seed.length; i++) {
            item = model.seed[i];
            await db.executeAsync(new QueryExpression().insert(item).into(model.source))
        }
        await db.closeAsync();
    }
    catch (err) {
        await db.closeAsync();
        throw err;
    }
    
    
}

async function initDatabase() {
    // change NODE_ENV (do not log statement while adding data)
    process.env.NODE_ENV = 'devel';
    // create migrations
    await migrateAsync(Customers);
    await migrateAsync(Shippers);
    await migrateAsync(Categories);
    await migrateAsync(Suppliers);
    await migrateAsync(Employees);
    await migrateAsync(Products);
    await migrateAsync(Orders);
    await migrateAsync(OrderDetails);
    // restore NODE_ENV
    process.env.NODE_ENV = 'development';
}

export {
    migrateAsync,
    initDatabase
};