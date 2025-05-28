import React from 'react';
import EventForm from './components/EventForm'; // EventForm を読み込みます

function HomePage() {
  return (
    <div>
      <h1>日程調整アプリへようこそ！</h1>
      <p>新しいイベントを作成するか、共有されたURLにアクセスしてください。</p>
      <hr />
      <EventForm />
    </div>
  );
}

export default HomePage;