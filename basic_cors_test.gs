/**
 * @fileoverview A minimal Apps Script for testing CORS.
 * This script contains the most basic implementation of doGet, doPost, and doOptions
 * to correctly handle cross-origin requests from a web app.
 */

/**
 * Handles GET requests from the client.
 * It ignores any query parameters and returns a simple JSON success message
 * with the required CORS header.
 *
 * @param {Object} e The event parameter from the GET request.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  const response = { status: 'success', message: 'GET test successful!' };

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Handles the actual POST request from the client.
 * It ignores the request body and returns a simple JSON success message
 * with the required CORS header.
 *
 * @param {Object} e The event parameter from the POST request.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  const response = { status: 'success', message: 'POST test successful!' };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Handles the browser's pre-flight OPTIONS request.
 * This is good practice to include, even if client requests are "simple".
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * A test function to run doGet directly from the Apps Script editor.
 * This allows you to verify the function's output without making a web request.
 */
function testDoGet() {
  // Simulate the event object 'e' that doGet receives.
  // For a simple GET test, it can be an empty object.
  const mockEvent = {};

  try {
    // Call the doGet function with the mock event.
    const response = doGet(mockEvent);
    
    // Log the content of the response to the Apps Script logger.
    Logger.log("✅ SUCCESS: doGet returned the following content:");
    Logger.log(response.getContent());
  } catch (e) {
    Logger.log(`❌ ERROR in testDoGet: ${e.toString()}`);
  }
}

/**
 * A test function to run doPost directly from the Apps Script editor.
 * This allows you to verify the function's output without making a web request.
 */
function testDoPost() {
  // Simulate the event object 'e' for a POST request.
  // The 'contents' property is a stringified JSON, which is what Apps Script provides.
  const mockEvent = {
    postData: {
      contents: JSON.stringify({ message: "hello from test" })
    }
  };

  try {
    // Call the doPost function with the mock event.
    const response = doPost(mockEvent);
    
    // Log the content of the response to the Apps Script logger.
    Logger.log("✅ SUCCESS: doPost returned the following content:");
    Logger.log(response.getContent());
  } catch (e) {
    Logger.log(`❌ ERROR in testDoPost: ${e.toString()}`);
  }
}