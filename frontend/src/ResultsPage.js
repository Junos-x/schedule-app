import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
// import './ResultsPage.css'; 

function ResultsPage() {
  let { uniqueUrl } = useParams();
  const [eventResults, setEventResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const statusMap = {
    3: '終日OK',
    2: '日中OK',
    1: '夜OK',
    0: 'NG',
    null: '-',
  };

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://127.0.0.1:5000/api/events/${uniqueUrl}/results`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `結果の取得に失敗しました (Status: ${response.status})`);
        }
        const data = await response.json();
        setEventResults(data);
      } catch (err) {
        console.error("結果データの取得に失敗:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [uniqueUrl]);

  if (loading) return <div>結果を読み込み中...</div>;
  if (error) return <div style={{ color: 'red' }}>エラー: {error}</div>;
  if (!eventResults || !eventResults.results) return <div>結果データが見つかりません。</div>;

  const allParticipants = [];
  eventResults.results.forEach(dateResult => {
    dateResult.responses.forEach(response => {
      if (!allParticipants.includes(response.participant_name)) {
        allParticipants.push(response.participant_name);
      }
    });
  });
  allParticipants.sort();

  const allDates = eventResults.results.map(dr => dr.date).sort();

  const participantAnswers = {};
  allParticipants.forEach(name => {
    participantAnswers[name] = {};
  });
  eventResults.results.forEach(dateResult => {
    dateResult.responses.forEach(response => {
      if (participantAnswers[response.participant_name]) {
        participantAnswers[response.participant_name][dateResult.date] = response.status;
      }
    });
  });

  // --- ここからハイライトロジックの修正 ---
  const dateHighlightMap = {};

  // 2人間で会えるかどうかの判定関数
  const canTwoPeopleMeet = (status1, status2) => {
    if (status1 === null || status1 === undefined || status2 === null || status2 === undefined) return false; // 未回答者は会えない
    if (status1 === 0 || status2 === 0) return false; // どちらかがNGなら会えない

    // パターン1: どちらかが終日OK(3)なら、もう片方がNG(0)以外なら会える
    if (status1 === 3 && status2 !== 0) return true;
    if (status2 === 3 && status1 !== 0) return true;

    // パターン2: 日中OK(2)同士なら会える
    if (status1 === 2 && status2 === 2) return true;

    // パターン3: 夜OK(1)同士なら会える
    if (status1 === 1 && status2 === 1) return true;
    
    return false; // 上記以外は会えない
  };

  allDates.forEach(date => {
    const responsesForDate = eventResults.results.find(dr => dr.date === date)?.responses || [];
    const participantsForDate = responsesForDate.map(r => r.participant_name);
    
    if (participantsForDate.length < 2) { // 参加者が2人未満の日はハイライトしない
      dateHighlightMap[date] = false;
      return;
    }

    let everyoneCanMeet = true; // その日に全員が会えるかのフラグ
    // 全ての参加者のペアについて会えるかチェック
    for (let i = 0; i < participantsForDate.length; i++) {
      for (let j = i + 1; j < participantsForDate.length; j++) {
        const p1Name = participantsForDate[i];
        const p2Name = participantsForDate[j];
        
        const p1Status = participantAnswers[p1Name]?.[date];
        const p2Status = participantAnswers[p2Name]?.[date];

        if (!canTwoPeopleMeet(p1Status, p2Status)) {
          everyoneCanMeet = false; // 一組でも会えないペアがいたらダメ
          break;
        }
      }
      if (!everyoneCanMeet) break;
    }
    dateHighlightMap[date] = everyoneCanMeet;
  });
  // --- ハイライトロジックの修正ここまで ---

  return (
    <div>
      <h1>{eventResults.name} - 回答結果</h1>
      <p>{eventResults.description || '説明はありません。'}</p>
      <hr />
      {allDates.length > 0 && allParticipants.length > 0 ? (
        <table className="results-table" style={{borderCollapse: 'collapse', width: 'auto', border: '1px solid #ccc', marginTop: '20px'}}>
          <thead>
            <tr>
              <th style={{border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2'}}>日付</th>
              {allParticipants.map(participantName => (
                <th key={participantName} style={{border: '1px solid #ccc', padding: '8px', backgroundColor: '#f2f2f2', whiteSpace: 'nowrap'}}>{participantName}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allDates.map(date => (
              <tr key={date} style={{backgroundColor: dateHighlightMap[date] ? 'rgba(255, 192, 203, 0.3)' : 'transparent'}}>
                <td style={{border: '1px solid #ccc', padding: '8px', fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                  {date}
                </td>
                {allParticipants.map(participantName => {
                  const status = participantAnswers?.[participantName]?.[date];
                  return (
                    <td 
                      key={`${date}-${participantName}`} 
                      style={{border: '1px solid #ccc', padding: '8px', textAlign: 'center'}}
                    >
                      {statusMap[status !== undefined ? status : null] || statusMap[null]}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>まだ回答がないか、有効な候補日がありません。</p>
      )}
    </div>
  );
}

export default ResultsPage;