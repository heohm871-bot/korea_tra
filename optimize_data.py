import json
import re

# 파일 경로 설정
input_file = '../홈페이지 크롤링/data/area_contents.js'
output_file = 'data_places_new.js'

print(f"Loading {input_file}...")
try:
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()
except FileNotFoundError:
    print(f"Error: {input_file} 파일을 찾을 수 없습니다.")
    exit()

# JS 파일에서 JSON 객체 부분만 추출 (export const ... 제거)
match = re.search(r'export const areaContents = ({.*});', content, re.DOTALL)
if match:
    json_str = match.group(1)
else:
    json_str = content.replace('export const areaContents = ', '').strip().rstrip(';')

try:
    data = json.loads(json_str)
except json.JSONDecodeError as e:
    print(f"JSON 파싱 실패: {e}")
    exit()

optimized_data = []
no_coord_count = 0

# 데이터 순회 및 추출
for area_code, area_val in data.items():
    sigungu_dict = area_val.get('sigungu', {})
    for sigungu_code, sigungu_val in sigungu_dict.items():
        contents_dict = sigungu_val.get('contents', {})
        for type_key, items_list in contents_dict.items():
            if isinstance(items_list, list):
                for item in items_list:
                    # 좌표 추출 시도 (VisitKorea API는 보통 mapy=위도, mapx=경도)
                    try:
                        lat = float(item.get('mapy', 0))
                        lng = float(item.get('mapx', 0))
                        
                        # 좌표가 0이거나 없으면 건너뜀
                        if lat == 0 or lng == 0:
                            no_coord_count += 1
                            continue 

                        # 꼭 필요한 정보만 남김 (Data Diet)
                        optimized_item = {
                            'title': item.get('title', ''),
                            'lat': round(lat, 5),  # 소수점 5자리로 줄여 용량 절약
                            'lng': round(lng, 5),
                            'address': item.get('addr1', ''),
                            'category': item.get('contenttypeid', ''),
                            # 이미지가 없으면 빈 문자열
                            'image': item.get('firstimage', '') or item.get('firstimage2', '')
                        }
                        optimized_data.append(optimized_item)
                    except (ValueError, TypeError):
                        no_coord_count += 1
                        continue

# 결과 출력
print(f"총 처리된 장소: {len(optimized_data)}개")
print(f"제외됨 (좌표 없음): {no_coord_count}개")

if len(optimized_data) == 0:
    print("\n[중요] 변환된 데이터가 0개입니다! 원본 데이터에 좌표(mapx, mapy)가 없습니다.")
    print("크롤러를 수정하여 좌표를 받아와야 합니다.")
else:
    # JS 파일로 저장
    js_content = f"const placeData = {json.dumps(optimized_data, ensure_ascii=False)};"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
    print(f"\n성공! {output_file} 파일이 생성되었습니다.")
    print("이제 index.html에서 이 파일을 사용하면 로딩이 훨씬 빨라집니다.")
