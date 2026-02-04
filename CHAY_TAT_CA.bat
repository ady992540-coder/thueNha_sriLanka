@echo off
chcp 65001 > nul
:menu
cls
echo ======================================================
echo       HỆ THỐNG GỬI TIN BẤT ĐỘNG SẢN SRI LANKA
echo ======================================================
echo 1. Chạy Dehiwala
echo 2. Chạy Colombo3
echo 3. Chạy Nugegoda
echo 4. Chạy Piliyandala
echo 5. Chạy Maharagama
echo 6. CHẠY TẤT CẢ (Lần lượt từng quận)
echo 7. Thoát
echo ======================================================
set /p choice="Chọn số (1-7): "

if "%choice%"=="1" (
    echo Đang chạy Dehiwala...
    cd Dehiwala
    node Dehiwala_index.js
    cd ..
    pause
    goto menu
)
if "%choice%"=="2" (
    echo Đang chạy Colombo3...
    cd Colombo3
    node Colombo3_index.js
    cd ..
    pause
    goto menu
)
if "%choice%"=="3" (
    echo Đang chạy Nugegoda...
    cd Nugegoda
    node Nugegoda_index.js
    cd ..
    pause
    goto menu
)
if "%choice%"=="4" (
    echo Đang chạy Piliyandala...
    cd Piliyandala
    node Piliyandala_index.js
    cd ..
    pause
    goto menu
)
if "%choice%"=="5" (
    echo Đang chạy Maharagama...
    cd Maharagama
    node Maharagama_index.js
    cd ..
    pause
    goto menu
)
if "%choice%"=="6" (
    echo ------------------------------------------
    echo [1/5] Đang chạy Dehiwala...
    cd Dehiwala
    node Dehiwala_index.js
    cd ..
    
    echo ------------------------------------------
    echo [2/5] Đang chạy Colombo3...
    cd Colombo3
    node Colombo3_index.js
    cd ..
    
    echo ------------------------------------------
    echo [3/5] Đang chạy Nugegoda...
    cd Nugegoda
    node Nugegoda_index.js
    cd ..
    
    echo ------------------------------------------
    echo [4/5] Đang chạy Piliyandala...
    cd Piliyandala
    node Piliyandala_index.js
    cd ..

    echo ------------------------------------------
    echo [5/5] Đang chạy Maharagama...
    cd Maharagama
    node Maharagama_index.js
    cd ..
    
    echo ==========================================
    echo === TẤT CẢ QUẬN ĐÃ HOÀN THÀNH ===
    echo ==========================================
    pause
    goto menu
)
if "%choice%"=="7" exit
goto menu
