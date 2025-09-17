/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// A list of realistic, common User-Agent strings to rotate through.
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'
];

// A list of common Accept-Language headers.
const ACCEPT_LANGUAGES = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9,es;q=0.8',
    'es-ES,es;q=0.9,en;q=0.8',
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
];

/**
 * A wrapper around the native `fetch` function that adds randomized headers
 * to each request to make it appear more unique and less robotic, helping to
 * evade basic fingerprinting and automated traffic analysis.
 *
 * @param url The URL to fetch.
 * @param options The standard fetch options object.
 * @returns A Promise that resolves with the Response object.
 */
export const stealthFetch = (url: string, options?: RequestInit): Promise<Response> => {
    // Pick random headers for this specific request
    const randomUserAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const randomLanguage = ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];

    // Clone existing headers or create a new Headers object
    const headers = new Headers(options?.headers);

    // Set the randomized and standard headers
    headers.set('User-Agent', randomUserAgent);
    headers.set('Accept-Language', randomLanguage);
    headers.set('Referer', window.location.origin); // Set a plausible Referer

    // Build the final request options
    const requestOptions: RequestInit = {
        ...options,
        headers: headers,
        mode: 'cors', // Ensure CORS is handled correctly
        credentials: 'omit'
    };

    console.log(`Stealth Fetch: UA='${randomUserAgent}', Lang='${randomLanguage}'`);

    // Perform the fetch call with the modified options
    return fetch(url, requestOptions);
};