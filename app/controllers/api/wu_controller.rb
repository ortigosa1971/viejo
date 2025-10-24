# app/controllers/api/wu_controller.rb
# frozen_string_literal: true
require 'net/http'
require 'uri'
require 'json'

module Api
  class WuController < ApplicationController
    protect_from_forgery with: :null_session

    def history
      date = params[:date].to_s
      unless date.match?(/^\d{8}$/)
        return render json: { error: 'date requerido (YYYYMMDD)' }, status: 422
      end

      station_id = ENV['WU_STATION_ID'] || (Rails.application.credentials.dig(:wu, :station_id) rescue nil)
      api_key    = ENV['WU_API_KEY']    || (Rails.application.credentials.dig(:wu, :api_key) rescue nil)

      unless station_id && api_key
        return render json: { error: 'Faltan WU_STATION_ID o WU_API_KEY en Rails' }, status: 500
      end

      url = URI("https://api.weather.com/v2/pws/history/all?stationId=#{station_id}&format=json&units=m&date=#{date}&apiKey=#{api_key}")
      begin
        resp = Net::HTTP.get_response(url)
        unless resp.is_a?(Net::HTTPSuccess)
          return render json: { error: "WU HTTP #{resp.code}", body: resp.body }, status: 502
        end
        data = JSON.parse(resp.body) rescue {}
        obs  = (data['observations'] || data['obs'] || [])

        rows = obs.map do |o|
          metric = o['metric'] || {}
          t_local = o['obsTimeLocal']
          if !t_local && o['obsTimeLocalEpoch']
            t_local = Time.at(o['obsTimeLocalEpoch']).getlocal.strftime('%Y-%m-%d %H:%M')
          end
          {
            'timeLocal' => t_local || o['obsTimeUtc'],
            'temp'      => metric['tempAvg']  || metric['temp'] || metric['tempHigh'] || metric['tempLow'],
            'dew'       => metric['dewptAvg'] || metric['dewpt'] || metric['dewptHigh'] || metric['dewptLow'],
            'rh'        => o['humidityAvg'] || o['humidity'] || metric['humidityAvg'],
            'pres'      => metric['pressureAvg'] || metric['pressure'] || metric['pressureMax'] || metric['pressureMin'],
            'w'         => metric['windspeedAvg'] || metric['windspeed'] || metric['windSpeed'],
            'gust'      => metric['windgustHigh'] || metric['windGust'],
            'uv'        => o['uvHigh'] || o['uv'],
            'rad'       => o['solarRadiationHigh'] || o['solarRadiation']
          }
        end

        rows.compact!
        rows.sort_by! { |r| r['timeLocal'].to_s }

        render json: { rows: rows }
      rescue => e
        render json: { error: e.message }, status: 500
      end
    end
  end
end
