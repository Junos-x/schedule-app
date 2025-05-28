from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import uuid
from datetime import datetime, timedelta

# --- Flaskアプリの初期化 ---
app = Flask(__name__)
CORS(app)

# --- データベースの設定 ---
basedir = os.path.abspath(os.path.dirname(__file__))
# RenderのDATABASE_URL環境変数を優先し、なければローカルのSQLiteを使用
# RenderのPostgreSQL接続文字列は 'postgres://' で始まるので 'postgresql://' に置換
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL or 'sqlite:///' + os.path.join(basedir, 'app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- データベースモデルの定義 ---
class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(200))
    unique_url = db.Column(db.String(36), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    dates = db.relationship('Date', backref='event', lazy=True, cascade="all, delete-orphan")

class Date(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('event.id'), nullable=False)
    candidate_date = db.Column(db.Date, nullable=False)
    responses = db.relationship('Response', backref='date', lazy=True, cascade="all, delete-orphan")

class Response(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    date_id = db.Column(db.Integer, db.ForeignKey('date.id'), nullable=False)
    participant_name = db.Column(db.String(50), nullable=False)
    status = db.Column(db.Integer, nullable=False) # 0:NG, 1:夜, 2:日中, 3:終日
    comment = db.Column(db.String(100))

# --- APIエンドポイントの定義 ---

@app.route('/')
def hello_world():
    return 'Hello from Flask Backend with DB!'

# !!! 注意: これはテーブル作成のための一時的なエンドポイントです。 !!!
# !!! テーブル作成後は必ず削除するかコメントアウトしてください。      !!!
@app.route('/init_db_on_render_once_then_delete') # URLは推測されにくいものに
def init_db_on_render():
    try:
        with app.app_context(): # アプリケーションコンテキスト内で実行
            db.create_all()
        
        # テーブルが実際に作成されたか確認 (SQLAlchemy 2.x 以降の推奨)
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        table_names = inspector.get_table_names()

        return f"Database tables created (or already exist). Tables: {table_names}. PLEASE DELETE THIS ROUTE NOW from app.py."
    except Exception as e:
        return f"An error occurred during DB initialization: {str(e)}"

# イベント作成API (期間指定対応)
@app.route('/api/events', methods=['POST'])
def create_event():
    data = request.get_json()
    if not data or not data.get('name') or not data.get('start_date') or not data.get('end_date'):
        return jsonify({'error': 'Missing name, start_date, or end_date'}), 400
    try:
        start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400
    if start_date > end_date:
        return jsonify({'error': 'Start date cannot be after end date.'}), 400
    if (end_date - start_date).days > 35: # 期間制限 (例: 35日)
         return jsonify({'error': 'Date range cannot exceed 35 days.'}), 400

    new_url = str(uuid.uuid4())
    new_event = Event(
        name=data['name'],
        description=data.get('description', ''),
        unique_url=new_url
    )
    db.session.add(new_event)
    db.session.commit()

    current_date = start_date
    while current_date <= end_date:
        new_date = Date(event_id=new_event.id, candidate_date=current_date)
        db.session.add(new_date)
        current_date += timedelta(days=1)
    db.session.commit()
    return jsonify({'message': 'Event created with date range!', 'event_url': new_url}), 201

# イベント情報取得API
@app.route('/api/events/<string:unique_url>', methods=['GET'])
def get_event(unique_url):
    event = Event.query.filter_by(unique_url=unique_url).first_or_404()
    dates_list = [d.candidate_date.strftime('%Y-%m-%d') for d in event.dates]
    event_data = {
        'id': event.id, 'name': event.name, 'description': event.description,
        'unique_url': event.unique_url, 'dates': dates_list
    }
    return jsonify(event_data)

# 回答登録API (現在はPUTで上書きするので、純粋な新規登録としては使わないかも)
@app.route('/api/events/<string:unique_url>/responses', methods=['POST'])
def add_response(unique_url):
    event = Event.query.filter_by(unique_url=unique_url).first_or_404()
    data = request.get_json()
    if not data or not data.get('participant_name') or not data.get('responses'):
        return jsonify({'error': 'Missing participant name or responses'}), 400
    participant_name = data['participant_name']
    responses_data = data['responses']

    event_dates_map = {d.candidate_date: d for d in event.dates}

    for resp_item in responses_data:
        date_str = resp_item.get('date')
        status = resp_item.get('status')
        if not date_str or status is None:
            db.session.rollback()
            return jsonify({'error': f'Invalid response item (missing date or status): {resp_item}'}), 400
        try:
            cand_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            db.session.rollback()
            return jsonify({'error': f'Invalid date format: {date_str}. Use YYYY-MM-DD.'}), 400
        
        date_obj = event_dates_map.get(cand_date)

        if date_obj:
            new_response = Response(
                date_id=date_obj.id,
                participant_name=participant_name,
                status=status,
                comment=resp_item.get('comment', '')
            )
            db.session.add(new_response)
        else:
            db.session.rollback()
            return jsonify({'error': f'Date {date_str} not found for this event.'}), 400
    db.session.commit()
    return jsonify({'message': 'Responses added successfully!'}), 201

# 回答修正API (特定参加者の回答を全て上書き)
@app.route('/api/events/<string:unique_url>/responses', methods=['PUT'])
def update_responses(unique_url):
    event = Event.query.filter_by(unique_url=unique_url).first_or_404()
    data = request.get_json()

    if not data or not data.get('participant_name') or not data.get('responses'):
        return jsonify({'error': 'Missing participant name or responses'}), 400

    participant_name_to_update = data['participant_name']
    new_responses_data = data['responses']

    event_dates_map = {d.candidate_date: d for d in event.dates}
    date_ids_for_event = [d.id for d in event.dates]

    if not date_ids_for_event:
        return jsonify({'error': 'No dates found for this event to update responses for.'}), 404

    Response.query.filter(
        Response.date_id.in_(date_ids_for_event),
        Response.participant_name == participant_name_to_update
    ).delete(synchronize_session='fetch')

    for resp_item in new_responses_data:
        date_str = resp_item.get('date')
        status = resp_item.get('status')

        if not date_str or status is None:
            db.session.rollback()
            return jsonify({'error': f'Invalid response item (missing date or status): {resp_item}'}), 400
        try:
            cand_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            db.session.rollback()
            return jsonify({'error': f'Invalid date format: {date_str}. Use YYYY-MM-DD.'}), 400
        
        date_obj = event_dates_map.get(cand_date)

        if date_obj:
            new_response = Response(
                date_id=date_obj.id,
                participant_name=participant_name_to_update,
                status=status,
                comment=resp_item.get('comment', '')
            )
            db.session.add(new_response)
        else:
            db.session.rollback()
            return jsonify({'error': f'Date {date_str} not found for this event when trying to update.'}), 400
    
    db.session.commit()
    return jsonify({'message': 'Responses updated successfully!'}), 200

# 結果取得API
@app.route('/api/events/<string:unique_url>/results', methods=['GET'])
def get_results(unique_url):
    event = Event.query.filter_by(unique_url=unique_url).first_or_404()
    results = []
    sorted_dates = sorted(event.dates, key=lambda d: d.candidate_date)

    for date_obj in sorted_dates:
        date_str = date_obj.candidate_date.strftime('%Y-%m-%d')
        responses_list = []
        sorted_responses = sorted(date_obj.responses, key=lambda r: r.participant_name)
        for response_obj in sorted_responses:
            responses_list.append({
                'participant_name': response_obj.participant_name,
                'status': response_obj.status, 'comment': response_obj.comment
            })
        results.append({'date': date_str, 'responses': responses_list})
    return jsonify({'name': event.name, 'description': event.description, 'results': results})

# --- サーバー起動 ---
if __name__ == '__main__':
    # ローカル開発時のみ、DATABASE_URLが設定されていなければSQLiteのDBファイルを初期化
    if 'DATABASE_URL' not in os.environ:
        if not os.path.exists(os.path.join(basedir, 'app.db')):
            with app.app_context():
                db.create_all()
                print("Local SQLite Database created!")
    app.run(debug=True)