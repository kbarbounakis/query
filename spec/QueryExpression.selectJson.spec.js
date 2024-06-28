import { Guid } from '@themost/common';
import {MemberExpression, MethodCallExpression} from '../src/index';
import { QueryEntity, QueryExpression } from '../src/index';
import { SqliteFormatter } from '@themost/sqlite';
import { MemoryAdapter } from './test/TestMemoryAdapter';
import { MemoryFormatter } from './test/TestMemoryFormatter';
import { isObjectDeep } from './is-object';

if (typeof SqliteFormatter.prototype.$jsonGet !== 'function') {
    SqliteFormatter.prototype.$jsonGet = function(expr) {
        if (typeof expr.$name !== 'string') {
            throw new Error('Invalid json expression. Expected a string');
        }
        const parts = expr.$name.split('.');
        const extract = this.escapeName(parts.splice(0, 2).join('.'));
        return `json_extract(${extract}, '$.${parts.join('.')}')`;
    };
    SqliteFormatter.prototype.$jsonArray = function(expr) {
        return `json_each(${this.escapeName(expr)})`;
    }
    const superEscape = SqliteFormatter.prototype.escape;
    SqliteFormatter.prototype.escape = function(value, quoted) {
        if (isObjectDeep(value)) {
            return `'${JSON.stringify(value)}'`;
        }
        return superEscape.call(this, value, quoted);
    }
}

const OrderSchema = {
    name: 'Orders',
    source: 'Orders',
    fields: [
        { name: 'id', type: 'Guid', primary: true },
        { name: 'customer', type: 'Json' },
        { name: 'employee', type: 'Json' },
        { name: 'orderDate', type: 'Date' },
        { name: 'shipper', type: 'Json' }
    ]
};


describe('SqlFormatter', () => {

    /**
     * @type {MemoryAdapter}
     */
    let db;
    beforeAll(() => {
        db = new MemoryAdapter({
            name: 'local',
            database: './spec/db/local.db'
        });
    });
    afterAll((done) => {
        if (db) {
            db.close();
            return done();
        }
    });

    fit('should select json field', async () => {
        const exists = await db.table('Orders').existsAsync();
        if (!exists) {
            await db.table('Orders').createAsync(OrderSchema.fields);
        }
        const Orders = new QueryEntity('Orders');
        const insertQuery = new QueryExpression().insert({
            'id': Guid.newGuid().toString(),
            'shipper': {
                'shipperName': 'Speedy Express',
                'phone': '(503) 555-9831'
            },
            'employee': {
                'lastName': 'Fuller',
                'firstName': 'Andrew',
                'birthDate': '1952-02-19 00:00:00',
                'photo': 'EmpID2.pic',
                'notes': 'Andrew received his BTS commercial and a Ph.D. in international marketing from the University of Dallas. He is fluent in French and Italian and reads German. He joined the company as a sales representative, was promoted to sales manager and was then named vice president of sales. Andrew is a member of the Sales Management Roundtable, the Seattle Chamber of Commerce, and the Pacific Rim Importers Association.'
            },
            'customer': {
                'customerName': 'Berglunds snabbköp',
                'contactName': 'Christina Berglund',
                'address': 'Berguvsvägen 8',
                'city': 'Luleå',
                'postalCode': 'S-958 22',
                'country': 'Sweden'
            },
            'orderDate': '1996-07-04 17:37:00'
        },).into(Orders);
        await db.executeAsync(insertQuery);
        const query = new QueryExpression();
        query.resolvingJoinMember.subscribe((event) => {
            event.object = query.$collection;
            event.member = new MethodCallExpression('jsonGet', [
                new MemberExpression(query.$collection + '.' + event.fullyQualifiedMember)
            ]);
        });
        query.select((x) => {
                // noinspection JSUnresolvedReference
               return {
                   id: x.id,
                   customerName: x.customer.customerName
               }
            })
            .from(Orders);
        const formatter = new MemoryFormatter();
        const sql = formatter.format(query);
        expect(sql).toEqual('SELECT `Orders`.`id` AS `id`, json_extract(`Orders`.`customer`, \'$.customerName\') AS `customerName` FROM `Orders`');
        const results = await db.executeAsync(sql, []);
        expect(results).toBeTruthy();
    });


    it('should select json array', async () => {
        const Products = new QueryEntity('Products');
        const query = new QueryExpression();
        query.resolvingJoinMember.subscribe((event) => {
            if (event.fullyQualifiedMember.startsWith('tags')) {
                event.object = query.$collection;
                event.member = new MethodCallExpression('jsonArray', [
                    new MemberExpression(query.$collection + '.' + event.fullyQualifiedMember)
                ]);
            }
        });
        query.select((x) => {
            // noinspection JSUnresolvedReference
            return {
                id: x.id,
                name: x.name,
                tags: x.tags
            }
        }).from(Products);
        const formatter = new MemoryFormatter();
        const sql = formatter.format(query);
        expect(sql).toEqual('SELECT Products.id AS id, Products.name AS name, json_extract(Products.dimensions, \'$.width\') AS tags FROM Products');
    });


});
