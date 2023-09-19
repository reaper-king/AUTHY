import { Pool } from 'pg';
import 'dotenv/config';
import fetch from 'node-fetch';

const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASS,
  DB_NAME,
  OE_HOST,
  OE_USER,
  OE_PASS,
} = process.env;

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  max: 20,
  connectionTimeoutMillis: 0,
  idleTimeoutMillis: 30000,
});

async function getCsrf() {
  try {
    const loginPageResponse = await fetch(`https://${OE_HOST}/OpenELIS-Global/LoginPage`);
    const responseBody = await loginPageResponse.text();
    const csrf = responseBody.split('csrf" value="')[1].split('"')[0];
    const jsessionid = String(loginPageResponse.headers.get('set-cookie')).split(';')[0];

    const formData = new URLSearchParams({
      loginName: OE_USER,
      password: OE_PASS,
      _csrf: csrf,
    });

    const loginOptions = {
      method: 'POST',
      headers: {
        cookie: jsessionid,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    };

    const authenticateResponse = await fetch(`https://${OE_HOST}/OpenELIS-Global/ValidateLogin`, loginOptions);
    const koekie = String(authenticateResponse.headers.get('set-cookie')).split(';')[0];

    if (koekie) {
      const homeResponse = await fetch(`https://${OE_HOST}/OpenELIS-Global/Home`, {
        method: 'GET',
        headers: {
          cookie: koekie,
        },
      });

      const newCSRF = (await homeResponse.text()).split('csrf" value="')[1].split('"')[0];
      console.log(koekie, newCSRF);

      await pool.query(`UPDATE registry.auth_session
                        SET session_id = '${koekie}', csrf_token = '${newCSRF}'
                        WHERE id = 1`);
    } else {
      console.log('Error occurred trying to authenticate');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

setInterval(getCsrf, 600000);
getCsrf();
