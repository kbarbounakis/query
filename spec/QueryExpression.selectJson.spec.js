import {QueryField, SqlFormatter} from '../src/index';
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
        const query = new QueryExpression()
            .select((x) => {
                // noinspection JSUnresolvedReference
               return {
                   id: x.id,
                   name: x.name,
                   width: {
                       $json: 'dimensions2.width'
                   }
               }
            })
            .from(Products);
        const formatter = new SqlFormatter();
        formatter.$json = function(expr) {
            const parts = expr.split('.');
            const [originalField] = parts.splice(0, 1);
          return `json_extract(${this.escapeName(originalField)}, '$.${parts.join('.')}')`
        };
        const sql = formatter.format(query);
        expect(sql).toBe('SELECT "Products"."id", "Products"."name", "Products"."dimensions2"->>\'width\' AS "width" FROM "Products"');
    });


});
