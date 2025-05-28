import React, { useState } from 'react';

function EventForm() {
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 新しく作成されたイベントのURLを保存するためのState
  const [createdEventUrl, setCreatedEventUrl] = useState('');
  // コピー成功メッセージ表示用State (任意)
  const [copySuccess, setCopySuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!eventName || !startDate || !endDate) {
      alert('イベント名、開始日、終了日をすべて入力してください！');
      return;
    }
    setCreatedEventUrl(''); // 新しいリクエストの前にクリア
    setCopySuccess('');     // 新しいリクエストの前にクリア

    const eventData = {
      name: eventName,
      description: description,
      start_date: startDate,
      end_date: endDate
    };

    try {
      const response = await fetch('http://127.0.0.1:5000/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      const result = await response.json();

      if (response.ok) {
        // alert(`イベントを作成しました！\n共有URL: ${result.event_url}\nこのURLをメモして、参加者に共有してください。`);
        setCreatedEventUrl(result.event_url); // StateにURLを保存
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

  // URLをクリップボードにコピーする関数
  const copyToClipboard = () => {
    if (createdEventUrl) {
      navigator.clipboard.writeText(`http://localhost:3000/event/${createdEventUrl}`)
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
        {/* イベント名、説明、開始日、終了日の入力欄 (変更なし) */}
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

      {/* 作成されたイベントURLとコピーボタンを表示する部分 */}
      {createdEventUrl && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid green' }}>
          <p>イベントを作成しました！以下のURLを参加者に共有してください。</p>
          <p>
            <strong>
              {/* フロントエンドの回答ページの完全なURLを表示 */}
              http://localhost:3000/event/{createdEventUrl}
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