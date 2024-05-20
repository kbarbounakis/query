import {MemberExpression, MethodCallExpression, SqlFormatter} from '../src/index';
import { QueryEntity, QueryExpression } from '../src/index';
import { MemoryAdapter } from './test/TestMemoryAdapter';

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

    it('should select json field', async () => {
        const Products = new QueryEntity('Products');
        const query = new QueryExpression();
        query.resolvingJoinMember.subscribe((event) => {
           if (event.fullyQualifiedMember.startsWith('dimensions')) {
               event.object = query.$collection;
               event.member = new MethodCallExpression('jsonGet', [
                   new MemberExpression(query.$collection + '.' + event.fullyQualifiedMember)
               ]);
           }
        });
        query.select((x) => {
                // noinspection JSUnresolvedReference
               return {
                   id: x.id,
                   name: x.name,
                   width: x.dimensions.width
               }
            })
            .from(Products);
        const formatter = new SqlFormatter();
        formatter.$jsonGet = function(expr) {
            if (typeof expr.$name !== 'string') {
                throw new Error('Invalid json expression. Expected a string');
            }
            const parts = expr.$name.split('.');
            const extract = this.escapeName(parts.splice(0, 2).join('.'));
            return `json_extract(${extract}, '$.${parts.join('.')}')`
        };
        const sql = formatter.format(query);
        expect(sql).toEqual('SELECT Products.id AS id, Products.name AS name, json_extract(Products.dimensions, \'$.width\') AS width FROM Products');
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
                tags: x.dimensions.width
            }
        })
            .from(Products);
        const formatter = new SqlFormatter();
        formatter.$jsonArray = function(expr) {
            return `json_each(${this.escapeName(expr)}')`
        };
        const sql = formatter.format(query);
        expect(sql).toEqual('SELECT Products.id AS id, Products.name AS name, json_extract(Products.dimensions, \'$.width\') AS width FROM Products');
    });


});
