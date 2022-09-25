import * as faunadb from "faunadb";

export const q = faunadb.query as any;
declare const FAUNA_DOMAIN: string;
declare const FAUNA_SECRET: string;


export const faunaClient = new faunadb.Client({ 
  domain: FAUNA_DOMAIN,
  secret: FAUNA_SECRET,
});