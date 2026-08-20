import { GetValueOptions, DanePobierzPelnyRaportOptions, DanePobierzRaportZbiorczyOptions } from './types.js';
/**
 * Class Bir provides access to REGON API
 *
 * @example Create a new Bir instance
 * ```js
 *   import Bir from 'bir1'
 *   const bir = new Bir()
 *   console.log(await bir.search({ nip: '5261040567' }))
 *   // output:
 *   // {
 *   //   regon: '011417295',
 *   //   nip: '5261040567',
 *   //   statusNip: '',
 *   //   nazwa: 'T-MOBILE POLSKA SPÓŁKA AKCYJNA',
 *   //   ...
 *   // }
 * ```
 */
export default class Bir {
    private key;
    private sid?;
    private prod;
    private _normalizeFn?;
    /**
     * Create a new Bir instance
     *
     * @remarks
     * If `options.key` is not provided, the internally stored public API key
     * is used to access non-production GUS database. It allows quick start,
     * however non-production database contains old and anonymized data.
     * Providing GUS provided key connects to the production database.
     */
    constructor(options?: {
        /**
         * API key provided by GUS.
         */
        key?: string;
        /**
         * Function to modify response to a more convenient format.
         */
        normalizeFn?: (obj: any) => any;
    });
    private normalize;
    private api;
    /**
     * Login to the API (method: Zaloguj)
     *
     * After successful login, the session id (`sid`) is stored in the
     * instance and used in subsequent requests.
     *
     * @remarks
     * This method must be called before any other method. It is called
     * automatically before other requests if the session id (`sid`) is
     * `undefined`.
     */
    login(): Promise<void>;
    /**
     * Automatically login to the API if not already logged in.
     */
    private autologin;
    /**
     * Get diagnostic information (method: GetValue)
     * @param value value to retrieve
     */
    value(value: GetValueOptions): Promise<string>;
    /**
     * Search (method: DaneSzukajPodmioty)
     * @param query
     * @param query.nip NIP number
     * @param query.regon REGON number
     * @param query.krs KRS number
     *
     * @remarks
     * Only one of the query parameters can be used at a time.
     */
    search(query: {
        nip: string;
    } | {
        regon: string;
    } | {
        krs: string;
    }): Promise<any>;
    /**
     * Retrive report (method: DanePobierzPelnyRaport)
     * @param query.regon REGON number
     * @param query.report report name
     */
    report(query: {
        regon: string;
        report: DanePobierzPelnyRaportOptions;
    }): Promise<any>;
    /**
     * Retrive summary report (method: DanePobierzRaportZbiorczy)
     * @param query.date date in format YYYY-MM-DD not earlier than week before
     * @param query.report report name
     */
    summary(query: {
        date: string;
        report: DanePobierzRaportZbiorczyOptions;
    }): Promise<any>;
    /**
     * Logout (method: Wyloguj)
     */
    logout(): Promise<void>;
}
