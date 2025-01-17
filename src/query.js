const makeClient = require('./client');
const {wsScheme} = require('./utils');
const {parse} = require('graphql/language');

const query = async function (options, successCb, errorCb) {
  const {
    query,
    extensions,
    operationName,
    endpoint,
    headers,
    variables,
    name,
  } = options;
  let client = makeClient({
    endpoint,
    headers,
  });

  let input, queryType;
  try {
    input = parse(query);

    if (input.definitions && input.definitions.length > 0) {
      if (name) {
        if (input.definitions.length > 1) {
          let found = false;
          for (let d of input.definitions) {
            if (d.name.value === name) {
              input = {kind: 'Document', definitions: [d]};
              queryType = d.operation;
              found = true;
              break;
            }
          }
          if (!found) {
            if (!errorCb) {
              throw ({
                error: `query with name '${name}' not found in input`,
              });
            }
            errorCb(
              {
                error: `query with name '${name}' not found in input`,
              },
              null,
              input,
            );
            return;
          }
        } else if (input.definitions[0].name.value !== name) {
          if (!errorCb) {
            throw ({
              error: `query with name '${name}' not found in input`,
            });
          }
          errorCb(
            {
              error: `query with name '${name}' not found in input`,
            },
            null,
            input,
          );
          return;
        }
      }
      queryType = input.definitions[0].operation;
    }
  } catch (err) {
    if (!errorCb) {
      throw err;
    }
    errorCb(
      err,
      null,
      input,
    );
  }

  const callbackWrapper = callback => data => {
    callback(data, queryType, input);
  };

  try {
    if (queryType === 'subscription') {
      client = makeClient({
        endpoint,
        headers,
        websocket: {
          endpoint: wsScheme(endpoint),
          onConnectionSuccess: () => {
            client.subscribe({
              subscription: query,
              variables},
            callbackWrapper(successCb),
            callbackWrapper(errorCb),
            );
          },
        },
      });
    } else {
      const data = {
        query: extensions ? undefined : query,
        extensions,
        operationName,
        variables,
      };
      // console.debug("data = " + JSON.stringify(data));
      await client.query(
        data,
        callbackWrapper(successCb),
        callbackWrapper(errorCb)
      );
    }
  } catch (err) {
    errorCb(err, null, null);
  }
};

module.exports = query;
