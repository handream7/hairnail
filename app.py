from flask import Flask, render_template, send_from_directory
import os

# Flask 앱을 생성합니다. 'static_folder'는 CSS, JS, 이미지 파일들이 있는 폴더를 지정합니다.
# 'template_folder'는 HTML 파일이 있는 폴더를 지정합니다.
app = Flask(__name__, 
            static_folder='static',
            template_folder='.') # 이제 templates 폴더가 아닌 루트 폴더의 index.html을 사용합니다.

@app.route('/')
def index():
    """
    프로젝트의 루트 폴더에 있는 index.html을 보여줍니다.
    """
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """
    static 폴더 안의 파일들을 서비스하기 위한 경로입니다.
    """
    return send_from_directory('static', path)


# 이 app.py 파일을 직접 실행했을 때만 웹 서버를 가동시킵니다.
if __name__ == '__main__':
    # host='0.0.0.0'은 어떤 IP 주소로든 접속을 허용한다는 의미입니다.
    # port는 Render.com에서 자동으로 지정해주는 값을 사용하도록 설정합니다.
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)

