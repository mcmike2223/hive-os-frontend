import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://hive-backend:8000/api/v1/hospitality/events', {
      name: 'Test Node.js Event',
      event_type: 'party',
      start_at: '2026-06-08 15:00:00',
      end_at: '2026-06-08 18:00:00',
      status: 'draft',
      is_private: false
    }, {
      headers: {
        'Accept': 'application/json',
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response?.status);
    console.error(err.response?.data);
  }
}

test();
