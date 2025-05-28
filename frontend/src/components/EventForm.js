import React, { useState } from 'react';

// APIのベースURLを環境変数から取得、なければローカル開発用を指定
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';

function EventForm() {
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [createdEventUrl, setCreatedEventUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!eventName || !startDate || !endDate) {
      alert('イベント名、開始日、終了日をすべて入力してください！');
      return;
    }
    setCreatedEventUrl('');
    setCopySuccess('');

    const eventData = {
      name: eventName,
      description: description,
      start_date: startDate,
      end_date: endDate
    };

    try {
      // APIエンドポイントを API_BASE_URL を使って指定
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const result = await response.json();

      if (response.ok) {
        setCreatedEventUrl(result.event_url);
        alert('イベントを作成しました！下に表示されたURLをコピーして共有してください。');
        setEventName('');
        setDescription('');
        setStartDate('');
        setEndDate('');
      } else {
        alert(`エラー: ${result.error || 'イベント作成に失敗しました。'}`);
      }
    } catch (error) {
      console.error('API呼び出しエラー:', error);
      alert('サーバーとの通信に失敗しました。バックエンドサーバーは動いていますか？');
    }
  };

  const copyToClipboard = () => {
    if (createdEventUrl) {
      // フロントエンドの回答ページの完全なURLをコピー
      const fullUrlToCopy = `${window.location.origin}/event/${createdEventUrl}`;
      navigator.clipboard.writeText(fullUrlToCopy)
        .then(() => {
          setCopySuccess('URLをコピーしました！');
        })
        .catch(err => {
          console.error('コピーに失敗しました: ', err);
          setCopySuccess('コピーに失敗しました。');
        });
    }
  };

  return (
    <div>
      <h2>新しいイベントを作成 (期間指定)</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="eventName">イベント名: </label>
          <input type="text" id="eventName" value={eventName} onChange={(e) => setEventName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="description">説明 (任意): </label>
          <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label htmlFor="startDate">開始日: </label>
          <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="endDate">終了日: </label>
          <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <br />
        <button type="submit">イベント作成</button>
      </form>

      {createdEventUrl && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid green' }}>
          <p>イベントを作成しました！以下のURLを参加者に共有してください。</p>
          <p>
            <strong>
              {/* window.location.origin を使って現在のフロントエンドのドメインを取得 */}
              {window.location.origin}/event/{createdEventUrl}
            </strong>
          </p>
          <button onClick={copyToClipboard}>URLをコピー</button>
          {copySuccess && <p style={{ color: 'green' }}>{copySuccess}</p>}
        </div>
      )}
    </div>
  );
}

export default EventForm;