import requestHandler from '../server.js';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
  maxDuration: 60,
};

export default function handler(req, res) {
  return requestHandler(req, res);
}
