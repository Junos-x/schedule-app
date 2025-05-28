import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './AnswerPage.css'; // CSSファイルを読み込みます

function AnswerPage() {
  let { uniqueUrl } = useParams();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({}); 
  const [participantName, setParticipantName] = useState('');
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [initialAnswersLoaded, setInitialAnswersLoaded] = useState(false);

  const statusOptions = [
      { value: 3, label: '終日OK', symbol: '◎' },
      { value: 2, label: '日中OK', symbol: '昼' },
      { value: 1, label: '夜OK',   symbol: '夜' },
      { value: 0, label: 'NG',     symbol: '×' }
  ];

  useEffect(() => {
    const fetchEventData = async () => {
      setLoading(true);
      setError(null);
      setSubmissionMessage(''); 
      setInitialAnswersLoaded(false); 
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/events/${uniqueUrl}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `イベントが見つかりません (Status: ${response.status})`);
        }
        const data = await response.json();
        setEvent(data);
      } catch (err) {
        setError(err.message);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    };
    fetchEventData();
  }, [uniqueUrl]);

  useEffect(() => {
    if (participantName && event && event.dates && !initialAnswersLoaded) {
      const loadParticipantAnswers = async () => {
        try {
          const response = await fetch(`http://127.0.0.1:5000/api/events/${uniqueUrl}/results`);
          if (!response.ok) {
            console.error("既存回答の取得に失敗 (results API)");
            return;
          }
          const resultsData = await response.json();
          
          const existingAnswers = {};
          let foundParticipant = false;
          resultsData.results.forEach(dateResult => {
            const participantResponse = dateResult.responses.find(
              resp => resp.participant_name === participantName
            );
            if (participantResponse) {
              existingAnswers[dateResult.date] = participantResponse.status;
              foundParticipant = true; 
            }
          });
          
          setAnswers(existingAnswers); // 既存回答で上書き、なければ空のまま
          if (foundParticipant) {
              setSubmissionMessage('以前の回答を読み込みました。必要に応じて修正してください。');
              setTimeout(() => setSubmissionMessage(''), 3000);
          } else {
             // 新規参加者の場合はメッセージなし、または「新規回答モード」などを表示しても良い
             setSubmissionMessage(''); // クリアしておく
          }
          setInitialAnswersLoaded(true);
        } catch (err) {
          console.error("既存回答のロード中にエラー:", err);
        }
      };
      loadParticipantAnswers();
    }
  }, [participantName, event, uniqueUrl, initialAnswersLoaded]);


  const handleAnswerChange = (date, status) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [date]: status,
    }));
    if (submissionMessage) setSubmissionMessage('');
  };

  const handleNameChange = (eventArg) => {
    const newName = eventArg.target.value;
    setParticipantName(newName);
    // 名前がクリアされた場合、または変更された場合は、回答とロード済みフラグをリセット
    if (newName === '' || newName !== participantName) { 
        setAnswers({});
        setInitialAnswersLoaded(false); 
    }
    if (submissionMessage) setSubmissionMessage(''); 
  };

  const handleSubmitAnswers = async (submissionEvent) => {
    submissionEvent.preventDefault(); 
    if (!participantName) {
        alert('参加者名を入力してください！');
        return;
    }
    if (!event || !event.dates || typeof event.dates.length === 'undefined') {
        alert('イベントデータが正しく読み込まれていません。');
        return;
    }
    if (Object.keys(answers).length !== event.dates.length) {
        alert('すべての日程に回答してください！');
        return;
    }
    const submissionData = {
        participant_name: participantName,
        responses: Object.keys(answers).map(date => ({
            date: date,
            status: answers[date]
        }))
    };
    // setSubmissionMessage('送信中...'); // 「送信中」は一旦表示しない形に戻しています
    try {
        const response = await fetch(`http://127.0.0.1:5000/api/events/${uniqueUrl}/responses`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(submissionData),
        });
        const result = await response.json();
        if (response.ok) {
            setSubmissionMessage('回答を送信・更新しました！ありがとうございます！');
            setInitialAnswersLoaded(false); // 送信後、同じ名前で再編集する場合のためにリセット
        } else {
            setSubmissionMessage(`エラー: ${result.error || '回答の送信/更新に失敗しました。'}`);
        }
    } catch (error) {
        setSubmissionMessage('サーバーとの通信に失敗しました。');
    }
  };

  if (loading && !event) return <div>読み込み中...</div>;
  if (error) return <div style={{ color: 'red' }}>エラー: {error}</div>;
  if (!event || !event.dates) {
    return <div>イベント情報が正しく読み込めませんでした。URLを確認するか、ページを再読み込みしてください。</div>;
  }
  
  return (
    <div>
      <h1>{event.name}</h1>
      <p>{event.description || '説明はありません。'}</p>
      <hr />
      <form onSubmit={handleSubmitAnswers}>
        <div className="participant-name">
            <label htmlFor="participantName">あなたの名前: </label>
            <input
                type="text"
                id="participantName"
                value={participantName}
                onChange={handleNameChange}
                placeholder="名前を入力して既存の回答を読み込み"
                required
            />
        </div>
        <hr />
        <h3>日程を入力してください:</h3>
        {/* ↓↓↓ ここに table-container div を追加 ↓↓↓ */}
        <div className="table-container"> 
          <table className="answer-table">
              <thead>
                  <tr>
                      <th>日付</th>
                      {statusOptions.map(option => <th key={option.value}>{option.label}</th>)}
                  </tr>
              </thead>
              <tbody>
                  {event.dates.map((date) => (
                      <tr key={date}>
                          <td>{date}</td>
                          {statusOptions.map((option) => (
                              <td 
                                  key={option.value} 
                                  style={{
                                      border: '1px solid #ccc', 
                                      padding: '10px 5px',
                                      textAlign: 'center', 
                                      cursor: 'pointer',
                                      fontWeight: answers[date] === option.value ? 'bold' : 'normal',
                                      backgroundColor: answers[date] === option.value ? 'rgba(173, 216, 230, 0.5)' : 'transparent' 
                                  }}
                                  onClick={() => handleAnswerChange(date, option.value)} 
                              >
                                  {option.symbol}
                                  <input
                                      type="radio"
                                      name={date}
                                      value={option.value}
                                      checked={answers[date] === option.value}
                                      onChange={() => {}} 
                                      style={{ display: 'none' }}
                                      aria-label={`${date} ${option.label}`}
                                  />
                              </td>
                          ))}
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
        {/* ↑↑↑ table-container div はここまで ↑↑↑ */}
        <br />
        <button type="submit">回答を送信</button>
      </form>
      {submissionMessage && (
        <p style={{ 
            color: submissionMessage.startsWith('エラー') || submissionMessage.startsWith('サーバー') ? 'red' : 'green', 
            marginTop: '10px',
          }}
        >
          {submissionMessage}
        </p>
      )}
      <hr style={{marginTop: '30px'}}/>
      <Link to={`/event/${uniqueUrl}/results`}>
        <button>このイベントの回答結果を見る</button>
      </Link>
    </div>
  );
}

export default AnswerPage;